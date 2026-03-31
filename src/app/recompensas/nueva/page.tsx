'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/lib/types';
import BackToMenu from '@/components/BackToMenu';
import FormLabel from '@/components/FormLabel';

function NuevaRecompensaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [definicion, setDefinicion] = useState('');
  const [frecuencia, setFrecuencia] = useState('semanal');
  const [duracion, setDuracion] = useState('');
  const [comunOPersonal, setComunOPersonal] = useState('personal');
  const [puntosCanjear, setPuntosCanjear] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [estado, setEstado] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/'); return; }

    const { data: usrs } = await supabase
      .from('usuarios')
      .select('*')
      .eq('casa_id', session.user.id)
      .order('nombre');

    if (usrs) setUsuarios(usrs);

    if (editId) {
      const { data: recompensa } = await supabase
        .from('definicion_recompensas')
        .select('*')
        .eq('id', editId)
        .single();

      if (recompensa) {
        setNombre(recompensa.nombre);
        setDefinicion(recompensa.definicion || '');
        setFrecuencia(recompensa.frecuencia || 'semanal');
        setDuracion(recompensa.duracion?.toString() || '');
        setComunOPersonal(recompensa.comun_o_personal);
        setPuntosCanjear(recompensa.puntos_canjear.toString());
        setUsuarioId(recompensa.usuario_id || '');
        setEstado(recompensa.estado);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!puntosCanjear) { setError('Los puntos son obligatorios'); return; }
    if (comunOPersonal === 'personal' && !usuarioId) {
      setError('Selecciona un usuario para recompensa personal');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setSaving(true);
    setError('');

    const payload = {
      casa_id: session.user.id,
      nombre: nombre.trim(),
      definicion: definicion.trim() || null,
      frecuencia,
      duracion: duracion ? parseInt(duracion) : null,
      comun_o_personal: comunOPersonal,
      puntos_canjear: parseInt(puntosCanjear),
      usuario_id: comunOPersonal === 'personal' ? usuarioId : null,
      estado,
    };

    let result;
    if (editId) {
      result = await supabase.from('definicion_recompensas').update(payload).eq('id', editId);
    } else {
      result = await supabase.from('definicion_recompensas').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      router.push('/recompensas');
    }
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
      <h1 className="text-2xl font-bold text-center text-stone-800 mb-6">
        {editId ? 'Editar Recompensa' : 'Crear Recompensa'}
      </h1>

      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col gap-4">
          <div>
            <FormLabel label="Nombre" required help="Nombre de la recompensa que aparecerá en el papelito" />
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
          </div>

          <div>
            <FormLabel label="Descripción" help="Detalle de en qué consiste la recompensa" />
            <textarea value={definicion} onChange={(e) => setDefinicion(e.target.value)} rows={3}
              className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel label="Frecuencia" help="Periodo de tiempo en el que se acumulan los puntos para esta recompensa" />
              <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none">
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>
            </div>
            <div>
              <FormLabel label="Duración (periodos)" help="Cuántos periodos de la frecuencia dura la recompensa. Ej: Frecuencia semanal + Duración 2 = 2 semanas para conseguir los puntos" />
              <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)}
                min={1}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <FormLabel label="Tipo" help="Personal: solo un usuario puede conseguirla. Común: todos los usuarios pueden conseguirla" />
            <select value={comunOPersonal} onChange={(e) => setComunOPersonal(e.target.value)}
              className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none">
              <option value="personal">Personal (un usuario)</option>
              <option value="comun">Común (todos los usuarios)</option>
            </select>
          </div>

          {comunOPersonal === 'personal' && (
            <div>
              <FormLabel label="Usuario asignado" required help="Usuario que puede conseguir esta recompensa" />
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none">
                <option value="">Seleccionar usuario...</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <FormLabel label="Puntos para canjear" required help="Puntos necesarios acumulados en el periodo para obtener la recompensa" />
            <input type="number" value={puntosCanjear} onChange={(e) => setPuntosCanjear(e.target.value)}
              min={1}
              className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-stone-600">Estado:</label>
            <div
              onClick={() => setEstado(!estado)}
              className={`toggle-switch ${estado ? 'active' : ''}`}
            />
            <span className="text-sm text-stone-500">{estado ? 'Activa' : 'Inactiva'}</span>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-2xl shadow-lg transition-colors"
        >
          {saving ? 'Guardando...' : 'GUARDAR'}
        </button>
      </div>

      <BackToMenu />
    </div>
  );
}

export default function NuevaRecompensaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    }>
      <NuevaRecompensaContent />
    </Suspense>
  );
}
