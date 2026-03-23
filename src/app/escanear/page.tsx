'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { verificarRecompensas } from '@/lib/verificar-recompensas';
import { PapelitoRecompensa } from '@/lib/types';

export default function EscanearPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mensajeTipo, setMensajeTipo] = useState<'success' | 'error' | 'warning' | 'reward'>('success');
  const [recompensaConseguida, setRecompensaConseguida] = useState<PapelitoRecompensa | null>(null);
  const scannerRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setScanning(true);
    setMensaje('');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          await handleScan(decodedText);
        },
        () => {}
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setMensaje('Error al iniciar cámara: ' + errorMsg);
      setMensajeTipo('error');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      const scanner = scannerRef.current as { isScanning?: boolean; stop?: () => Promise<void> } | null;
      if (scanner && scanner.isScanning) {
        await scanner.stop!();
      }
    } catch {}
    scannerRef.current = null;
    setScanning(false);
  };

  const handleScan = async (papelitoId: string) => {
    // Pausar scanner mientras procesamos
    try {
      const scanner = scannerRef.current as { pause?: () => void } | null;
      if (scanner && scanner.pause) {
        scanner.pause();
      }
    } catch {}

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Buscar el papelito por ID (el QR contiene el UUID del papelito)
    const { data: papelito, error } = await supabase
      .from('papelito_tareas')
      .select('*, usuarios(nombre)')
      .eq('id', papelitoId)
      .eq('casa_id', session.user.id)
      .single();

    if (error || !papelito) {
      setMensaje('❌ Papelito no encontrado');
      setMensajeTipo('error');
      resumeScanner();
      return;
    }

    // Verificar si ya fue escaneado
    if (papelito.fecha_escaneo) {
      setMensaje('⚠️ Ya se ha escaneado este papelito');
      setMensajeTipo('warning');
      resumeScanner();
      return;
    }

    // Marcar como hecha y registrar fecha de escaneo
    const { error: updateError } = await supabase
      .from('papelito_tareas')
      .update({
        fecha_escaneo: new Date().toISOString(),
        estado: 'hecha',
      })
      .eq('id', papelitoId);

    if (updateError) {
      setMensaje('❌ Error al registrar: ' + updateError.message);
      setMensajeTipo('error');
      resumeScanner();
      return;
    }

    setMensaje(`✅ ¡"${papelito.nombre}" completada por ${papelito.usuarios?.nombre || 'usuario'}! +${papelito.puntos_ok} puntos`);
    setMensajeTipo('success');

    // Verificar recompensas
    if (papelito.usuario_id) {
      const resultado = await verificarRecompensas(session.user.id, papelito.usuario_id);
      if (resultado.recompensasConseguidas.length > 0) {
        const r = resultado.recompensasConseguidas[0];
        setRecompensaConseguida(r);
        setMensajeTipo('reward');
      }
    }

    // Reanudar scanner después de un delay
    setTimeout(() => {
      setRecompensaConseguida(null);
      resumeScanner();
    }, 3000);
  };

  const resumeScanner = () => {
    try {
      const scanner = scannerRef.current as { resume?: () => void } | null;
      if (scanner && scanner.resume) {
        scanner.resume();
      }
    } catch {}
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📷 Escanear Papelitos</h1>

      {!scanning ? (
        <div className="flex flex-col items-center gap-6 mt-10">
          <div className="w-32 h-32 bg-indigo-100 rounded-3xl flex items-center justify-center">
            <span className="text-6xl">📷</span>
          </div>
          <p className="text-gray-500 text-center max-w-xs">
            Escanea el código QR del papelito de tarea para registrarla como completada
          </p>
          <button
            onClick={startScanner}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg transition-colors"
          >
            ESCANEAR PAPELITO
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <div id="qr-reader" ref={containerRef} className="rounded-2xl overflow-hidden shadow-lg" />
        </div>
      )}

      {/* Mensajes */}
      {mensaje && (
        <div className={`mt-6 p-4 rounded-2xl shadow-lg max-w-md w-full text-center font-medium ${
          mensajeTipo === 'success' ? 'bg-green-100 text-green-800' :
          mensajeTipo === 'error' ? 'bg-red-100 text-red-800' :
          mensajeTipo === 'warning' ? 'bg-yellow-100 text-yellow-800' :
          'bg-purple-100 text-purple-800'
        }`}>
          {mensaje}
        </div>
      )}

      {/* Recompensa conseguida */}
      {recompensaConseguida && (
        <div className="mt-4 p-6 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-2xl shadow-lg max-w-md w-full text-center">
          <span className="text-4xl">🏆</span>
          <h3 className="text-xl font-bold text-amber-800 mt-2">¡Recompensa Conseguida!</h3>
          <p className="text-amber-700 mt-1">{recompensaConseguida.nombre}</p>
          {recompensaConseguida.definicion && (
            <p className="text-amber-600 text-sm mt-1">{recompensaConseguida.definicion}</p>
          )}
        </div>
      )}

      <button
        onClick={() => { stopScanner(); router.push('/menu'); }}
        className="fixed bottom-6 left-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-md transition-colors z-50"
      >
        ← SALIR
      </button>
    </div>
  );
}
