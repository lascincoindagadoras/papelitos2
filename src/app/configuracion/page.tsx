'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Ajustes } from '@/lib/types';
import { getMXW01Printer, PrinterStatus } from '@/lib/mxw01-printer';
import BackToMenu from '@/components/BackToMenu';
import FormLabel from '@/components/FormLabel';

export default function ConfiguracionPage() {
  const router = useRouter();
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const [nombreImpresora, setNombreImpresora] = useState('');
  const [horaManana, setHoraManana] = useState('08:00');
  const [horaTarde, setHoraTarde] = useState('16:00');
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>('disconnected');

  useEffect(() => {
    loadAjustes();
  }, []);

  const loadAjustes = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/'); return; }

    const { data, error } = await supabase
      .from('ajustes')
      .select('*')
      .eq('casa_id', session.user.id)
      .single();

    if (data) {
      setAjustes(data);
      setNombreImpresora(data.nombre_impresora || '');
      setHoraManana(data.hora_manana || '08:00');
      setHoraTarde(data.hora_tarde || '16:00');
    } else if (error && error.code !== 'PGRST116') {
      setMensaje('⚠️ Error cargando ajustes: ' + error.message);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setSaving(true);
    const { error } = await supabase
      .from('ajustes')
      .upsert({
        casa_id: session.user.id,
        nombre_impresora: nombreImpresora || null,
        hora_manana: horaManana,
        hora_tarde: horaTarde,
      }, { onConflict: 'casa_id' });

    setSaving(false);
    if (error) {
      setMensaje('❌ Error al guardar: ' + error.message);
    } else {
      setMensaje('✅ Configuración guardada');
    }
    setTimeout(() => setMensaje(''), 3000);
  };

  const handleBuscarBluetooth = async () => {
    const printer = getMXW01Printer();
    printer.onStatusChange = setPrinterStatus;

    try {
      await printer.connect();
      setNombreImpresora(printer.deviceName || 'MXW01');
      setMensaje(`✅ Conectada: ${printer.deviceName}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      if (errorMsg.includes('cancelled') || errorMsg.includes('canceled')) {
        setPrinterStatus('disconnected');
      } else {
        setMensaje('❌ Error: ' + errorMsg);
      }
    }
    setTimeout(() => setMensaje(''), 4000);
  };

  const handleTestPrint = async () => {
    const printer = getMXW01Printer();
    if (printer.status !== 'ready') {
      setMensaje('⚠️ Conecta la impresora primero');
      setTimeout(() => setMensaje(''), 3000);
      return;
    }
    try {
      await printer.testPrint();
      setMensaje('✅ Test de impresión enviado');
    } catch (err: unknown) {
      setMensaje('❌ Error: ' + (err instanceof Error ? err.message : 'Error'));
    }
    setTimeout(() => setMensaje(''), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-24">
      <h1 className="text-2xl font-bold text-center text-stone-800 mb-6">Configuración</h1>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Impresora */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-stone-700 mb-4">Impresora Térmica MXW01</h2>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                printerStatus === 'ready' ? 'bg-green-500' :
                printerStatus === 'connecting' || printerStatus === 'printing' ? 'bg-amber-500 animate-pulse' :
                'bg-gray-400'
              }`} />
              <span className="text-sm text-stone-600">
                {printerStatus === 'disconnected' && 'Desconectada'}
                {printerStatus === 'connecting' && 'Conectando...'}
                {printerStatus === 'ready' && `Conectada: ${nombreImpresora}`}
                {printerStatus === 'printing' && 'Imprimiendo...'}
                {printerStatus === 'error' && 'Error de conexión'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleBuscarBluetooth}
              disabled={printerStatus === 'connecting' || printerStatus === 'printing'}
              className="w-full bg-stone-700 hover:bg-stone-800 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {printerStatus === 'connecting' ? 'Conectando...' :
               printerStatus === 'ready' ? '🔄 Reconectar Impresora' :
               '🖨️ Conectar Impresora'}
            </button>

            {printerStatus === 'ready' && (
              <button
                onClick={handleTestPrint}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                🧪 Imprimir Test
              </button>
            )}
          </div>
        </div>

        {/* Horarios */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-stone-700 mb-4">Horarios de Impresión</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormLabel label="Hora mañana" help="Hora a la que se imprimen los papelitos de la mañana" />
              <input
                type="time"
                value={horaManana}
                onChange={(e) => setHoraManana(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <FormLabel label="Hora tarde" help="Hora a la que se imprimen los papelitos de la tarde" />
              <input
                type="time"
                value={horaTarde}
                onChange={(e) => setHoraTarde(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {mensaje && (
          <div className={`text-center p-3 rounded-xl ${
            mensaje.startsWith('✅') ? 'bg-green-100 text-green-800' :
            mensaje.startsWith('⚠️') ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {mensaje}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white font-bold py-4 rounded-2xl shadow-lg transition-colors"
        >
          {saving ? 'Guardando...' : 'GUARDAR CONFIGURACIÓN'}
        </button>
      </div>

      <BackToMenu />
    </div>
  );
}
