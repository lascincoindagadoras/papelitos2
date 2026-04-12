/**
 * MXW01 Thermal Printer - Web Bluetooth Driver
 * Protocol: Proprietary bitmap-based (NOT ESC/POS)
 * Ref: https://github.com/PinThePenguinOne/MXW01_Thermal-Printer-Tool
 */

// --- BLE UUIDs ---
const SERVICE_UUID = '0000ae30-0000-1000-8000-00805f9b34fb';
const CONTROL_UUID = '0000ae01-0000-1000-8000-00805f9b34fb'; // Write commands
const NOTIFY_UUID  = '0000ae02-0000-1000-8000-00805f9b34fb'; // Notifications
const DATA_UUID    = '0000ae03-0000-1000-8000-00805f9b34fb'; // Bulk bitmap data

const PRINTER_WIDTH_PX = 384;
const PRINTER_WIDTH_BYTES = PRINTER_WIDTH_PX / 8; // 48

// --- CRC-8 (polynomial 0x07) ---
function crc8(data: Uint8Array): number {
  let crc = 0x00;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
    }
  }
  return crc;
}

// --- Packet builders ---
function cmdWithCrc(id: number, data: number[]): Uint8Array {
  const d = new Uint8Array(data);
  const len = data.length;
  return new Uint8Array([0x22, 0x21, id, 0x00, len & 0xFF, (len >> 8) & 0xFF, ...data, crc8(d), 0xFF]);
}

function cmdSimple(id: number, data: number[]): Uint8Array {
  const len = data.length;
  return new Uint8Array([0x22, 0x21, id, 0x00, len & 0xFF, (len >> 8) & 0xFF, ...data, 0x00, 0x00]);
}

// --- Response parser ---
function parseNotification(data: DataView): { cmdId: number; payload: Uint8Array } | null {
  if (data.byteLength < 8 || data.getUint8(0) !== 0x22 || data.getUint8(1) !== 0x21) return null;
  const cmdId = data.getUint8(2);
  const payloadLen = data.getUint16(4, true);
  if (data.byteLength < 6 + payloadLen) return { cmdId, payload: new Uint8Array(0) };
  const payload = new Uint8Array(data.buffer, data.byteOffset + 6, payloadLen);
  return { cmdId, payload };
}

// --- Connection state ---
export type PrinterStatus = 'disconnected' | 'connecting' | 'ready' | 'printing' | 'error';

export interface MXW01Printer {
  status: PrinterStatus;
  deviceName: string | null;
  connect(): Promise<void>;
  disconnect(): void;
  printBitmap(data: Uint8Array, height: number): Promise<void>;
  printText(lines: string[], fontSize?: number): Promise<void>;
  printPapelito(papelito: {
    nombre: string;
    definicion?: string | null;
    usuario?: string;
    fecha: string;
    puntos_ok: number;
    puntos_ko: number;
    codigo: string;
  }): Promise<void>;
  testPrint(): Promise<void>;
  onStatusChange?: (status: PrinterStatus) => void;
}

export function createMXW01Printer(): MXW01Printer {
  let device: BluetoothDevice | null = null;
  let server: BluetoothRemoteGATTServer | null = null;
  let controlChar: BluetoothRemoteGATTCharacteristic | null = null;
  let notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
  let dataChar: BluetoothRemoteGATTCharacteristic | null = null;

  // Notification response handling
  const responses = new Map<number, Uint8Array>();
  const waiters = new Map<number, () => void>();

  function handleNotification(event: Event) {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const parsed = parseNotification(target.value!);
    if (!parsed) return;
    responses.set(parsed.cmdId, parsed.payload);
    const waiter = waiters.get(parsed.cmdId);
    if (waiter) {
      waiters.delete(parsed.cmdId);
      waiter();
    }
  }

  function waitForResponse(cmdId: number, timeoutMs = 7000): Promise<Uint8Array> {
    const existing = responses.get(cmdId);
    if (existing) {
      responses.delete(cmdId);
      return Promise.resolve(existing);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(cmdId);
        reject(new Error(`Timeout esperando respuesta 0x${cmdId.toString(16)}`));
      }, timeoutMs);
      waiters.set(cmdId, () => {
        clearTimeout(timer);
        const payload = responses.get(cmdId) || new Uint8Array(0);
        responses.delete(cmdId);
        resolve(payload);
      });
    });
  }

  function setStatus(s: PrinterStatus) {
    printer.status = s;
    printer.onStatusChange?.(s);
  }

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Helper: convert Uint8Array to a fresh ArrayBuffer for writeValueWithoutResponse
  function toBuffer(arr: Uint8Array): ArrayBuffer {
    const buf = new ArrayBuffer(arr.byteLength);
    new Uint8Array(buf).set(arr);
    return buf;
  }

  // --- Core print sequence ---
  async function sendPrintJob(bitmapData: Uint8Array, height: number) {
    if (!controlChar || !dataChar) throw new Error('Impresora no conectada');

    // Step 1: Setup B1 → A2 → A1, wait A1
    responses.delete(0xA1);
    const setupCmds = [
      cmdWithCrc(0xB1, [0x00]),
      cmdWithCrc(0xA2, [0x5D]),
      cmdWithCrc(0xA1, [0x00]),
    ];
    for (const cmd of setupCmds) {
      await controlChar.writeValueWithoutResponse(toBuffer(cmd));
      await delay(15);
    }
    const a1 = await waitForResponse(0xA1);
    if (a1.length < 8 || a1[6] !== 0) throw new Error('Impresora no lista (A1 status)');

    // Step 2: Print request A2 → A9, wait A9
    responses.delete(0xA9);
    const heightLE = [height & 0xFF, (height >> 8) & 0xFF];
    const widthLE = [PRINTER_WIDTH_BYTES & 0xFF, (PRINTER_WIDTH_BYTES >> 8) & 0xFF];
    await controlChar.writeValueWithoutResponse(toBuffer(cmdWithCrc(0xA2, [0x5D])));
    await delay(15);
    await controlChar.writeValueWithoutResponse(toBuffer(cmdSimple(0xA9, [...heightLE, ...widthLE])));
    await delay(15);
    const a9 = await waitForResponse(0xA9);
    if (a9.length < 1 || a9[0] !== 0) throw new Error('Impresora rechazó el trabajo (A9 status)');

    // Step 3: Send bitmap data in 20-byte chunks via ae03
    const chunkSize = 20;
    for (let i = 0; i < bitmapData.length; i += chunkSize) {
      const chunk = bitmapData.slice(i, Math.min(i + chunkSize, bitmapData.length));
      await dataChar.writeValueWithoutResponse(toBuffer(chunk));
    }

    // Step 4: End print AD, wait AA
    responses.delete(0xAA);
    await controlChar.writeValueWithoutResponse(toBuffer(cmdSimple(0xAD, [0x00])));
    const printTimeout = Math.max(15000, height * 50);
    await waitForResponse(0xAA, printTimeout);
  }

  // --- Text to bitmap ---
  function textToBitmap(lines: string[], fontSize = 28): { data: Uint8Array; height: number } {
    const canvas = document.createElement('canvas');
    canvas.width = PRINTER_WIDTH_PX;

    const lineHeight = fontSize + 8;
    const topPadding = 10;
    const bottomPadding = 10;

    // Word-wrap lines to fit width
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${fontSize}px Arial, sans-serif`;

    const wrappedLines: string[] = [];
    for (const line of lines) {
      if (!line) { wrappedLines.push(''); continue; }
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        if (ctx.measureText(test).width <= PRINTER_WIDTH_PX - 20) {
          current = test;
        } else {
          if (current) wrappedLines.push(current);
          current = word;
        }
      }
      if (current) wrappedLines.push(current);
    }

    const totalHeight = topPadding + wrappedLines.length * lineHeight + bottomPadding;
    canvas.height = totalHeight;

    // Redraw with correct height
    const c = canvas.getContext('2d')!;
    c.fillStyle = 'white';
    c.fillRect(0, 0, PRINTER_WIDTH_PX, totalHeight);
    c.fillStyle = 'black';
    c.font = `${fontSize}px Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'top';

    let y = topPadding;
    for (const line of wrappedLines) {
      c.fillText(line, PRINTER_WIDTH_PX / 2, y);
      y += lineHeight;
    }

    // Convert canvas to 1-bit bitmap (MXW01 format)
    // Threshold 200: Canvas anti-aliases text creating gray pixels;
    // anything darker than very light gray is treated as black for crisp output.
    const imageData = c.getImageData(0, 0, PRINTER_WIDTH_PX, totalHeight);
    const pixels = imageData.data;
    const bitmap = new Uint8Array(PRINTER_WIDTH_BYTES * totalHeight);

    for (let row = 0; row < totalHeight; row++) {
      for (let col = 0; col < PRINTER_WIDTH_PX; col++) {
        const idx = (row * PRINTER_WIDTH_PX + col) * 4;
        const gray = pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
        if (gray < 200) { // Aggressive threshold: anti-aliased grays → black
          const byteIdx = row * PRINTER_WIDTH_BYTES + Math.floor(col / 8);
          bitmap[byteIdx] |= (1 << (col % 8));
        }
      }
    }

    return { data: bitmap, height: totalHeight };
  }

  // --- QR code to bitmap (simple version-1 QR) ---
  // For proper QR we use a canvas-rendered QR from an image element
  function qrToBitmap(text: string, size: number): Promise<{ data: Uint8Array; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = PRINTER_WIDTH_PX;
        canvas.height = size + 20; // padding
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false; // No interpolation → crisp QR pixels
        const x = (PRINTER_WIDTH_PX - size) / 2;
        ctx.drawImage(img, x, 10, size, size);

        const imageData = ctx.getImageData(0, 0, PRINTER_WIDTH_PX, canvas.height);
        const pixels = imageData.data;
        const bitmap = new Uint8Array(PRINTER_WIDTH_BYTES * canvas.height);
        for (let row = 0; row < canvas.height; row++) {
          for (let col = 0; col < PRINTER_WIDTH_PX; col++) {
            const idx = (row * PRINTER_WIDTH_PX + col) * 4;
            const gray = pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114;
            if (gray < 200) { // Aggressive threshold for crisp QR
              const byteIdx = row * PRINTER_WIDTH_BYTES + Math.floor(col / 8);
              bitmap[byteIdx] |= (1 << (col % 8));
            }
          }
        }
        resolve({ data: bitmap, height: canvas.height });
      };
      img.onerror = () => reject(new Error('Error cargando QR'));
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=0`;
    });
  }

  // --- Merge multiple bitmaps vertically ---
  function mergeBitmaps(parts: Array<{ data: Uint8Array; height: number }>): { data: Uint8Array; height: number } {
    const totalHeight = parts.reduce((sum, p) => sum + p.height, 0);
    const merged = new Uint8Array(PRINTER_WIDTH_BYTES * totalHeight);
    let offset = 0;
    for (const part of parts) {
      merged.set(part.data, offset);
      offset += part.data.length;
    }
    return { data: merged, height: totalHeight };
  }

  // --- Separator line bitmap ---
  function separatorBitmap(dashWidth = 4, gapWidth = 4): { data: Uint8Array; height: number } {
    const height = 5; // 1px line + 2px padding top/bottom
    const bitmap = new Uint8Array(PRINTER_WIDTH_BYTES * height);
    const lineRow = 2; // middle row
    for (let col = 0; col < PRINTER_WIDTH_PX; col++) {
      const pos = col % (dashWidth + gapWidth);
      if (pos < dashWidth) {
        const byteIdx = lineRow * PRINTER_WIDTH_BYTES + Math.floor(col / 8);
        bitmap[byteIdx] |= (1 << (col % 8));
      }
    }
    return { data: bitmap, height };
  }

  // --- Blank space ---
  function blankBitmap(rows: number): { data: Uint8Array; height: number } {
    return { data: new Uint8Array(PRINTER_WIDTH_BYTES * rows), height: rows };
  }

  const printer: MXW01Printer = {
    status: 'disconnected' as PrinterStatus,
    deviceName: null,

    async connect() {
      if (!navigator.bluetooth) throw new Error('Web Bluetooth no disponible');

      setStatus('connecting');
      try {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'MXW' }],
          optionalServices: [SERVICE_UUID],
        });

        printer.deviceName = device.name || device.id;

        device.addEventListener('gattserverdisconnected', () => {
          setStatus('disconnected');
          printer.deviceName = null;
        });

        server = await device.gatt!.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);

        controlChar = await service.getCharacteristic(CONTROL_UUID);
        notifyChar = await service.getCharacteristic(NOTIFY_UUID);
        dataChar = await service.getCharacteristic(DATA_UUID);

        await notifyChar.startNotifications();
        notifyChar.addEventListener('characteristicvaluechanged', handleNotification);

        setStatus('ready');
      } catch (err) {
        setStatus('error');
        throw err;
      }
    },

    disconnect() {
      if (notifyChar) {
        try { notifyChar.removeEventListener('characteristicvaluechanged', handleNotification); } catch {}
      }
      if (server?.connected) {
        try { server.disconnect(); } catch {}
      }
      device = null;
      server = null;
      controlChar = null;
      notifyChar = null;
      dataChar = null;
      setStatus('disconnected');
      printer.deviceName = null;
    },

    async printBitmap(data: Uint8Array, height: number) {
      setStatus('printing');
      try {
        await sendPrintJob(data, height);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        throw err;
      }
    },

    async printText(lines: string[], fontSize = 28) {
      const { data, height } = textToBitmap(lines, fontSize);
      await printer.printBitmap(data, height);
    },

    async printPapelito(papelito) {
      setStatus('printing');
      try {
        const parts: Array<{ data: Uint8Array; height: number }> = [];

        // Header
        parts.push(textToBitmap([`📝 ${papelito.nombre}`], 28));
        if (papelito.definicion) {
          parts.push(textToBitmap([papelito.definicion], 20));
        }
        parts.push(separatorBitmap());

        // Details
        parts.push(textToBitmap([
          `👤 ${papelito.usuario || 'Sin asignar'}`,
          `📅 ${papelito.fecha}`,
        ], 22));

        // Points
        parts.push(textToBitmap([
          `✅ +${papelito.puntos_ok} pts  |  ❌ ${papelito.puntos_ko} pts`,
        ], 22));
        parts.push(separatorBitmap());

        // QR Code (280px ~ 73% del ancho para legibilidad a distancia)
        try {
          const qr = await qrToBitmap(papelito.codigo, 280);
          parts.push(qr);
        } catch {
          parts.push(textToBitmap(['[QR no disponible]'], 16));
        }

        // Footer
        parts.push(textToBitmap([`Código: ${papelito.codigo.substring(0, 8)}`], 14));
        parts.push(blankBitmap(30)); // Paper feed at bottom

        const { data, height } = mergeBitmaps(parts);
        await sendPrintJob(data, height);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        throw err;
      }
    },

    async testPrint() {
      await printer.printText([
        'MXW01 - Test',
        '¡Impresora conectada!',
        new Date().toLocaleString('es-ES'),
      ], 28);
    },
  };

  return printer;
}

// Singleton instance
let _printer: MXW01Printer | null = null;
export function getMXW01Printer(): MXW01Printer {
  if (!_printer) _printer = createMXW01Printer();
  return _printer;
}
