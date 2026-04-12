'use client';
import { useState, useRef } from 'react';

// Generate all 0x0000XX00 16-bit vendor UUIDs (BLE base UUID format)
function make16bitUUID(short: number): string {
  return `0000${short.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
}

// All common 16-bit short UUIDs used by cheap thermal printers + vendor ranges
const PRINTER_SERVICE_UUIDS: string[] = [
  // Well-known thermal printer UUIDs
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART / Microchip
  // Scan all common vendor 16-bit ranges (0xFE00-0xFFFF and others)
  ...Array.from({ length: 256 }, (_, i) => make16bitUUID(0xff00 + i)), // FF00-FFFF
  ...Array.from({ length: 256 }, (_, i) => make16bitUUID(0xfe00 + i)), // FE00-FEFF
  ...Array.from({ length: 256 }, (_, i) => make16bitUUID(0xfd00 + i)), // FD00-FDFF
  ...Array.from({ length: 256 }, (_, i) => make16bitUUID(0xfb00 + i)), // FB00-FBFF
  ...Array.from({ length: 256 }, (_, i) => make16bitUUID(0xfa00 + i)), // FA00-FAFF
  make16bitUUID(0x18f0), // common thermal printer
  make16bitUUID(0xae00),
  make16bitUUID(0x1800), // Generic Access
  make16bitUUID(0x1801), // Generic Attribute
];
const KNOWN_WRITE_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fff2-0000-1000-8000-00805f9b34fb',
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // Nordic UART TX
];

interface DiscoveredChar {
  serviceUuid: string;
  charUuid: string;
  properties: string[];
}

export default function TestImpresoraPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [discoveredChars, setDiscoveredChars] = useState<DiscoveredChar[]>([]);
  const [selectedChar, setSelectedChar] = useState<string>('');
  const [customText, setCustomText] = useState('¡Hola desde Papelitos! 🎉');
  const [scanMode, setScanMode] = useState<'name' | 'all'>('name');

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const log = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${ts}] ${msg}`]);
  };

  const clearLogs = () => setLogs([]);

  // ── Connect & Discover ──────────────────────────────────────
  const handleConnect = async () => {
    clearLogs();
    setDiscoveredChars([]);
    setConnected(false);
    writeCharRef.current = null;

    const nav = navigator as Navigator & { bluetooth?: WebBluetooth };
    if (!nav.bluetooth) {
      log('❌ Web Bluetooth no disponible. Usa Chrome/Edge.');
      return;
    }

    try {
      log(`🔍 Buscando dispositivos BLE (modo: ${scanMode === 'name' ? 'por nombre MXW' : 'todos'})...`);

      const requestOptions = scanMode === 'name'
        ? {
            filters: [
              { namePrefix: 'MXW' },
              { namePrefix: 'mxw' },
              { namePrefix: 'Printer' },
              { namePrefix: 'printer' },
            ],
            optionalServices: PRINTER_SERVICE_UUIDS,
          }
        : {
            acceptAllDevices: true as const,
            optionalServices: PRINTER_SERVICE_UUIDS,
          };

      const device = await nav.bluetooth.requestDevice(requestOptions);
      deviceRef.current = device;
      log(`📱 Dispositivo seleccionado: ${device.name || device.id}`);

      log('🔗 Conectando GATT...');
      const server = await device.gatt!.connect();
      serverRef.current = server;
      log('✅ GATT conectado');

      // Try to discover services - first generic, then by known UUIDs
      log('🔎 Descubriendo servicios...');
      const chars: DiscoveredChar[] = [];
      let autoWriteChar: BluetoothRemoteGATTCharacteristic | null = null;
      let servicesFound = 0;

      // Try getPrimaryServices() first (works on some printers)
      let services: BluetoothRemoteGATTService[] = [];
      try {
        services = await server.getPrimaryServices();
        servicesFound = services.length;
        log(`   getPrimaryServices() → ${services.length} servicio(s)`);
      } catch {
        log('   getPrimaryServices() no disponible, probando UUIDs conocidos...');
      }

      // If generic didn't work, try each known UUID individually
      if (services.length === 0) {
        log(`   Probando ${PRINTER_SERVICE_UUIDS.length} UUIDs conocidos (puede tardar)...`);
        let tried = 0;
        for (const uuid of PRINTER_SERVICE_UUIDS) {
          try {
            const svc = await server.getPrimaryService(uuid);
            services.push(svc);
            servicesFound++;
            log(`   ✅ ¡ENCONTRADO! Servicio: ${uuid}`);
          } catch {
            // silently skip
          }
          tried++;
          if (tried % 200 === 0) {
            log(`   ... ${tried}/${PRINTER_SERVICE_UUIDS.length} probados...`);
          }
        }
        log(`   Escaneo completo: ${tried} UUIDs probados.`);
      }

      if (servicesFound === 0) {
        log('⚠️ No se encontraron servicios. Prueba con chrome://bluetooth-internals');
        log('   1. Abre chrome://bluetooth-internals en otra pestaña');
        log('   2. Pestaña "Devices" → Start Scan → busca MXW01');
        log('   3. Pulsa "Inspect" en MXW01');
        log('   4. Copia aquí los Service UUIDs que aparezcan');
        setConnected(true);
        return;
      }

      log(`   Total: ${servicesFound} servicio(s) encontrado(s)`);

      for (const svc of services) {
        const svcUuid = svc.uuid;
        log(`   📦 Servicio: ${svcUuid}`);

        try {
          const characteristics = await svc.getCharacteristics();
          for (const ch of characteristics) {
            const props: string[] = [];
            if (ch.properties.read) props.push('read');
            if (ch.properties.write) props.push('write');
            if (ch.properties.writeWithoutResponse) props.push('writeNoResp');
            if (ch.properties.notify) props.push('notify');
            if (ch.properties.indicate) props.push('indicate');

            log(`      🔹 Char: ${ch.uuid} [${props.join(', ')}]`);
            chars.push({ serviceUuid: svcUuid, charUuid: ch.uuid, properties: props });

            // Auto-select known write characteristic
            if (!autoWriteChar && KNOWN_WRITE_CHAR_UUIDS.includes(ch.uuid) &&
                (ch.properties.write || ch.properties.writeWithoutResponse)) {
              autoWriteChar = ch;
            }
          }
        } catch (e) {
          log(`      ⚠️ No se pudieron leer características de ${svcUuid}`);
        }
      }

      setDiscoveredChars(chars);

      // Try known UUIDs first, otherwise pick first writable char
      if (!autoWriteChar) {
        const writable = chars.find(c =>
          c.properties.includes('write') || c.properties.includes('writeNoResp'));
        if (writable) {
          for (const svc of services) {
            if (svc.uuid === writable.serviceUuid) {
              const allChars = await svc.getCharacteristics();
              autoWriteChar = allChars.find(c => c.uuid === writable.charUuid) || null;
              break;
            }
          }
        }
      }

      if (autoWriteChar) {
        writeCharRef.current = autoWriteChar;
        setSelectedChar(autoWriteChar.uuid);
        log(`✅ Característica de escritura seleccionada: ${autoWriteChar.uuid}`);
      } else {
        log('⚠️ No se encontró característica de escritura automáticamente. Selecciónala manualmente.');
      }

      setConnected(true);
      log('🎉 ¡Listo para imprimir!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cancel')) {
        log('↩️ Selección cancelada.');
      } else {
        log(`❌ Error: ${msg}`);
      }
    }
  };

  // ── Select characteristic manually ─────────────────────────
  const handleSelectChar = async (charUuid: string) => {
    if (!serverRef.current) return;
    const info = discoveredChars.find(c => c.charUuid === charUuid);
    if (!info) return;

    try {
      const svc = await serverRef.current.getPrimaryService(info.serviceUuid);
      const ch = await svc.getCharacteristic(charUuid);
      writeCharRef.current = ch;
      setSelectedChar(charUuid);
      log(`✅ Seleccionada manualmente: ${charUuid}`);
    } catch (e) {
      log(`❌ Error seleccionando característica: ${e}`);
    }
  };

  // ── Send data in chunks (BLE has ~20 byte MTU by default) ──
  const sendData = async (data: Uint8Array) => {
    const ch = writeCharRef.current;
    if (!ch) throw new Error('No hay característica de escritura');

    const CHUNK_SIZE = 20;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (ch.properties.writeWithoutResponse) {
        await ch.writeValueWithoutResponse(chunk);
      } else {
        await ch.writeValueWithResponse(chunk);
      }
      // Small delay between chunks
      await new Promise(r => setTimeout(r, 50));
    }
  };

  // ── ESC/POS helpers ─────────────────────────────────────────
  const textEncoder = new TextEncoder();

  const escposInit = () => new Uint8Array([0x1B, 0x40]); // ESC @
  const escposBoldOn = () => new Uint8Array([0x1B, 0x45, 0x01]);
  const escposBoldOff = () => new Uint8Array([0x1B, 0x45, 0x00]);
  const escposCenterAlign = () => new Uint8Array([0x1B, 0x61, 0x01]);
  const escposLeftAlign = () => new Uint8Array([0x1B, 0x61, 0x00]);
  const escposFeedLines = (n: number) => new Uint8Array([0x1B, 0x64, n]);
  const escposDoubleSize = () => new Uint8Array([0x1D, 0x21, 0x11]); // width x2 + height x2
  const escposNormalSize = () => new Uint8Array([0x1D, 0x21, 0x00]);
  const escposText = (text: string) => textEncoder.encode(text);
  const newline = () => new Uint8Array([0x0A]);

  const concat = (...arrays: Uint8Array[]) => {
    const total = arrays.reduce((a, b) => a + b.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  };

  // ── Print test ticket ───────────────────────────────────────
  const handlePrintTest = async () => {
    if (!writeCharRef.current) {
      log('❌ No hay conexión. Conecta primero.');
      return;
    }
    setPrinting(true);
    try {
      log('🖨️ Enviando ticket de prueba...');

      const data = concat(
        escposInit(),
        escposCenterAlign(),
        escposDoubleSize(),
        escposBoldOn(),
        escposText('PAPELITOS'),
        newline(),
        escposNormalSize(),
        escposBoldOff(),
        newline(),
        escposText('--- Test de impresion ---'),
        newline(),
        newline(),
        escposLeftAlign(),
        escposText('Impresora: MXW01'),
        newline(),
        escposText(`Fecha: ${new Date().toLocaleDateString('es-ES')}`),
        newline(),
        escposText(`Hora:  ${new Date().toLocaleTimeString('es-ES')}`),
        newline(),
        newline(),
        escposCenterAlign(),
        escposBoldOn(),
        escposText('Si ves esto, funciona!'),
        newline(),
        escposBoldOff(),
        newline(),
        escposText('========================'),
        newline(),
        escposFeedLines(4),
      );

      await sendData(data);
      log('✅ ¡Ticket enviado con éxito!');
    } catch (err: unknown) {
      log(`❌ Error imprimiendo: ${err instanceof Error ? err.message : err}`);
    }
    setPrinting(false);
  };

  // ── Print custom text ───────────────────────────────────────
  const handlePrintCustom = async () => {
    if (!writeCharRef.current) {
      log('❌ No hay conexión. Conecta primero.');
      return;
    }
    setPrinting(true);
    try {
      log(`🖨️ Imprimiendo: "${customText}"`);

      const data = concat(
        escposInit(),
        escposCenterAlign(),
        escposText(customText),
        newline(),
        escposFeedLines(4),
      );

      await sendData(data);
      log('✅ Texto enviado');
    } catch (err: unknown) {
      log(`❌ Error: ${err instanceof Error ? err.message : err}`);
    }
    setPrinting(false);
  };

  // ── Disconnect ──────────────────────────────────────────────
  const handleDisconnect = () => {
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    setConnected(false);
    writeCharRef.current = null;
    setDiscoveredChars([]);
    setSelectedChar('');
    log('🔌 Desconectado');
  };

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-center text-stone-800 mb-2">
        🖨️ Test Impresora MXW01
      </h1>
      <p className="text-center text-stone-500 text-sm mb-6">
        Conecta y prueba la impresora térmica por Bluetooth (BLE)
      </p>

      {/* Connection */}
      <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
        <h2 className="font-bold text-stone-700 mb-3">1. Conexión</h2>

        {!connected && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setScanMode('name')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${scanMode === 'name' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : 'bg-stone-100 text-stone-500'}`}
            >
              Buscar &quot;MXW...&quot;
            </button>
            <button
              onClick={() => setScanMode('all')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${scanMode === 'all' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : 'bg-stone-100 text-stone-500'}`}
            >
              Mostrar todos
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {!connected ? (
            <button
              onClick={handleConnect}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl"
            >
              Conectar impresora
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl"
            >
              Desconectar
            </button>
          )}
        </div>

        {/* Show writable characteristics if multiple found */}
        {connected && discoveredChars.filter(c =>
          c.properties.includes('write') || c.properties.includes('writeNoResp')
        ).length > 1 && (
          <div className="mt-3">
            <p className="text-sm text-stone-600 mb-1">Característica de escritura:</p>
            <select
              value={selectedChar}
              onChange={(e) => handleSelectChar(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
            >
              {discoveredChars
                .filter(c => c.properties.includes('write') || c.properties.includes('writeNoResp'))
                .map(c => (
                  <option key={c.charUuid} value={c.charUuid}>
                    {c.charUuid} [{c.properties.join(', ')}]
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Print actions */}
      <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
        <h2 className="font-bold text-stone-700 mb-3">2. Imprimir</h2>

        <button
          onClick={handlePrintTest}
          disabled={!connected || printing}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl mb-3"
        >
          {printing ? 'Imprimiendo...' : 'Imprimir ticket de prueba'}
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="flex-1 border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none"
            placeholder="Texto personalizado..."
          />
          <button
            onClick={handlePrintCustom}
            disabled={!connected || printing}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded-xl"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-stone-900 rounded-2xl shadow-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-stone-300">Log</h2>
          <button onClick={clearLogs} className="text-stone-500 text-sm hover:text-stone-300">
            Limpiar
          </button>
        </div>
        <div className="font-mono text-xs text-green-400 max-h-64 overflow-y-auto space-y-0.5">
          {logs.length === 0 && <p className="text-stone-600">Pulsa &quot;Conectar&quot; para empezar...</p>}
          {logs.map((l, i) => (
            <p key={i} className={l.includes('❌') ? 'text-red-400' : l.includes('⚠️') ? 'text-yellow-400' : ''}>
              {l}
            </p>
          ))}
        </div>
      </div>

      <p className="text-center text-stone-400 text-xs mt-4">
        Abre esta página en Chrome/Edge con Bluetooth activado.
        <br />La impresora debe estar encendida y visible.
      </p>

      {/* Bluetooth internals helper */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-4">
        <h3 className="font-bold text-amber-800 text-sm mb-2">¿No encuentra servicios?</h3>
        <p className="text-xs text-amber-700 mb-2">
          Abre <code className="bg-amber-100 px-1 rounded">chrome://bluetooth-internals</code> en otra pestaña de Chrome.
          Ahí podrás ver TODOS los servicios de la MXW01 sin restricciones.
        </p>
        <ol className="text-xs text-amber-700 list-decimal ml-4 space-y-1">
          <li>Pestaña &quot;Devices&quot; → pulsa &quot;Start Scan&quot;</li>
          <li>Busca &quot;MXW01&quot; en la lista y pulsa &quot;Inspect&quot;</li>
          <li>Verás los Service UUIDs reales de la impresora</li>
          <li>Pégalos aquí abajo para probar</li>
        </ol>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            id="customUuid"
            placeholder="Pega un Service UUID aquí..."
            className="flex-1 text-xs border border-amber-300 rounded-lg px-2 py-1.5 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={async () => {
              const input = document.getElementById('customUuid') as HTMLInputElement;
              const uuid = input?.value?.trim().toLowerCase();
              if (!uuid) { log('⚠️ Introduce un UUID'); return; }
              if (!serverRef.current?.connected) { log('❌ Conecta primero'); return; }
              log(`🔎 Probando servicio: ${uuid}`);
              try {
                const svc = await serverRef.current.getPrimaryService(uuid);
                log(`✅ ¡ENCONTRADO! ${uuid}`);
                const characteristics = await svc.getCharacteristics();
                for (const ch of characteristics) {
                  const props: string[] = [];
                  if (ch.properties.read) props.push('read');
                  if (ch.properties.write) props.push('write');
                  if (ch.properties.writeWithoutResponse) props.push('writeNoResp');
                  if (ch.properties.notify) props.push('notify');
                  log(`   🔹 Char: ${ch.uuid} [${props.join(', ')}]`);
                  if (ch.properties.write || ch.properties.writeWithoutResponse) {
                    writeCharRef.current = ch;
                    setSelectedChar(ch.uuid);
                    log(`   ✅ Seleccionada para escritura: ${ch.uuid}`);
                  }
                }
              } catch {
                log(`❌ Servicio ${uuid} no encontrado. ¿Está la impresora conectada?`);
              }
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            Probar UUID
          </button>
        </div>
      </div>
    </div>
  );
}

// Type for Web Bluetooth (not built-in in all TS configs)
interface WebBluetooth {
  requestDevice: (options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
    optionalServices?: string[];
  }) => Promise<BluetoothDevice>;
  getDevices?: () => Promise<BluetoothDevice[]>;
}
