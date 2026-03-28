'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Ajustes } from '@/lib/types';
import BackToMenu from '@/components/BackToMenu';

export default function ConfiguracionPage() {
  const router = useRouter();
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const [nombreImpresora, setNombreImpresora] = useState('');
  const [horaManana, setHoraManana] = useState('08:00');
  const [horaTarde, setHoraTarde] = useState('16:00');
  const [bluetoothStatus, setBluetoothStatus] = useState<'idle' | 'searching' | 'connected' | 'error'>('idle');
  const [dispositivosBT, setDispositivosBT] = useState<Array<{ name: string; id: string }>>([]);

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
    // Web Bluetooth API - funciona en Chrome y Edge
    const nav = navigator as Navigator & {
      bluetooth?: {
        requestDevice: (options: {
          acceptAllDevices?: boolean;
          filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
          optionalServices?: string[];
        }) => Promise<{ name?: string; id: string }>;
        getDevices?: () => Promise<Array<{ name?: string; id: string }>>;
      };
    };
    if (!nav.bluetooth) {
      setMensaje('⚠️ Bluetooth no disponible en este navegador. Usa Chrome/Edge o la app Android.');
      setBluetoothStatus('error');
      return;
    }

    setBluetoothStatus('searching');
    setDispositivosBT([]);

    try {
      // Try to get already-paired devices first
      if (nav.bluetooth.getDevices) {
        try {
          const pairedDevices = await nav.bluetooth.getDevices();
          if (pairedDevices.length > 0) {
            const devices = pairedDevices.map(d => ({
              name: d.name || 'Dispositivo sin nombre',
              id: d.id,
            }));
            setDispositivosBT(devices);
          }
        } catch {
          // getDevices may not be supported, continue to requestDevice
        }
      }

      // Open browser device picker (shows all discoverable BLE devices)
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'generic_access',
          '000018f0-0000-1000-8000-00805f9b34fb', // Common thermal printer service
        ],
      });

      if (device) {
        setDispositivosBT(prev => {
          const exists = prev.some(d => d.id === device.id);
          return exists ? prev : [...prev, { name: device.name || 'Dispositivo', id: device.id }];
        });
        setNombreImpresora(device.name || device.id);
        setBluetoothStatus('connected');
        setMensaje(`✅ Dispositivo seleccionado: ${device.name || device.id}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      if (errorMsg.includes('cancelled') || errorMsg.includes('canceled')) {
        setBluetoothStatus('idle');
      } else {
        setBluetoothStatus('error');
        setMensaje('❌ Error Bluetooth: ' + errorMsg + '. Si no ves tu impresora, puede que use Bluetooth clásico (no BLE). Prueba desde la app Android.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-24">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">⚙️ Configuración</h1>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Impresora */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">🖨️ Configurar Impresora</h2>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-600 mb-1">Nombre de impresora</label>
            <input
              type="text"
              value={nombreImpresora}
              onChange={(e) => setNombreImpresora(e.target.value)}
              placeholder="Ej: Printer_58BT"
              className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleBuscarBluetooth}
            disabled={bluetoothStatus === 'searching'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {bluetoothStatus === 'searching' ? '🔍 Buscando dispositivos...' :
             bluetoothStatus === 'connected' ? '✅ Conectado - Buscar otra' :
             '🔘 Conectar Impresora Bluetooth'}
          </button>

          {dispositivosBT.length > 0 && (
            <div className="mt-3 space-y-2">
              {dispositivosBT.map((d) => (
                <div key={d.id} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                  <span>🖨️</span>
                  <span className="font-medium text-green-800">{d.name}</span>
                  <span className="text-green-600 text-sm ml-auto">Conectado</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Horarios */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">🕐 Horarios de Impresión</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Hora mañana</label>
              <input
                type="time"
                value={horaManana}
                onChange={(e) => setHoraManana(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Hora tarde</label>
              <input
                type="time"
                value={horaTarde}
                onChange={(e) => setHoraTarde(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 focus:border-indigo-500 focus:outline-none"
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
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-2xl shadow-lg transition-colors"
        >
          {saving ? 'Guardando...' : 'GUARDAR CONFIGURACIÓN'}
        </button>
      </div>

      <BackToMenu />
    </div>
  );
}
