'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/lib/types';
import BackToMenu from '@/components/BackToMenu';
import FormLabel from '@/components/FormLabel';

function NuevaTareaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [frecuencia, setFrecuencia] = useState<string>('diaria');
  const [dia, setDia] = useState('');
  const [semana, setSemana] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState('');
  const [definicion, setDefinicion] = useState('');
  const [puntosOk, setPuntosOk] = useState('');
  const [puntosKo, setPuntosKo] = useState('');
  const [estado, setEstado] = useState(true);
  const [usuarioId, setUsuarioId] = useState('');
  const [horaImpresion, setHoraImpresion] = useState('mañana');
  const [fechaCaducidad, setFechaCaducidad] = useState('');

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
      const { data: tarea } = await supabase
        .from('definicion_tareas')
        .select('*')
        .eq('id', editId)
        .single();

      if (tarea) {
        setNombre(tarea.nombre);
        setFrecuencia(tarea.frecuencia);
        setDia(tarea.dia?.toString() || '');
        setSemana(tarea.semana?.toString() || '');
        setMes(tarea.mes?.toString() || '');
        setAnio(tarea.anio?.toString() || '');
        setDefinicion(tarea.definicion || '');
        setPuntosOk(tarea.puntos_ok.toString());
        setPuntosKo(Math.abs(tarea.puntos_ko).toString());
        setEstado(tarea.estado);
        setUsuarioId(tarea.usuario_id || '');
        setHoraImpresion(tarea.hora_impresion || 'mañana');
        setFechaCaducidad(tarea.fecha_caducidad || '');
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!usuarioId) { setError('Selecciona un usuario'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setSaving(true);
    setError('');

    // puntos_ko siempre negativo
    const koValue = puntosKo ? -Math.abs(parseInt(puntosKo)) : 0;

    const payload = {
      casa_id: session.user.id,
      nombre: nombre.trim(),
      frecuencia,
      dia: dia ? parseInt(dia) : null,
      semana: semana ? parseInt(semana) : null,
      mes: mes ? parseInt(mes) : null,
      anio: anio ? parseInt(anio) : null,
      definicion: definicion.trim() || null,
      puntos_ok: puntosOk ? parseInt(puntosOk) : 0,
      puntos_ko: koValue,
      estado,
      usuario_id: usuarioId || null,
      hora_impresion: horaImpresion,
      fecha_caducidad: fechaCaducidad || null,
    };

    let result;
    if (editId) {
      result = await supabase.from('definicion_tareas').update(payload).eq('id', editId);
    } else {
      result = await supabase.from('definicion_tareas').insert(payload);
    }

    setSaving(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      router.push('/tareas');
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
        {editId ? 'Editar Tarea' : 'Crear Tarea'}
      </h1>

      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col gap-4">
          <div>
            <FormLabel label="Nombre de la tarea" required help="Nombre corto que aparecerá en el papelito impreso" />
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
          </div>

          <div>
            <FormLabel label="Descripción" help="Explicación detallada de cómo realizar la tarea" />
            <textarea value={definicion} onChange={(e) => setDefinicion(e.target.value)} rows={3}
              className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
          </div>

          <div>
            <FormLabel label="Usuario asignado" required help="Persona responsable de realizar esta tarea" />
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}
              className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none">
              <option value="">Seleccionar usuario...</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel label="Frecuencia" help="Cada cuánto tiempo se genera el papelito de esta tarea" />
              <select value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none">
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>
            </div>
            <div>
              <FormLabel label="Hora impresión" help="Momento del día en que se imprime el papelito" />
              <select value={horaImpresion} onChange={(e) => setHoraImpresion(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none">
                <option value="mañana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>
          </div>

          {frecuencia !== 'diaria' && (
            <div className="grid grid-cols-2 gap-3">
              {(frecuencia === 'semanal' || frecuencia === 'mensual' || frecuencia === 'anual') && (
                <div>
                  <FormLabel
                    label={frecuencia === 'semanal' ? 'Día semana (1=Lun)' : 'Día del mes'}
                    help={frecuencia === 'semanal' ? 'Día de la semana: 1=Lunes, 7=Domingo' : 'Número del día del mes (1-31)'}
                  />
                  <input type="number" value={dia} onChange={(e) => setDia(e.target.value)}
                    min={1} max={frecuencia === 'semanal' ? 7 : 31}
                    className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
                </div>
              )}
              {frecuencia === 'anual' && (
                <div>
                  <FormLabel label="Mes (1-12)" help="Mes del año en que se generará la tarea" />
                  <input type="number" value={mes} onChange={(e) => setMes(e.target.value)}
                    min={1} max={12}
                    className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel label="Puntos OK (+)" help="Puntos que gana el usuario al completar la tarea" />
              <input type="number" value={puntosOk} onChange={(e) => setPuntosOk(e.target.value)}
                min={0}
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
            </div>
            <div>
              <FormLabel label="Puntos KO (-)" help="Puntos que pierde el usuario si no completa la tarea" />
              <input type="number" value={puntosKo} onChange={(e) => setPuntosKo(e.target.value)}
                min={0} placeholder="Se guardará negativo"
                className="w-full border-2 border-stone-200 rounded-xl py-2 px-3 focus:border-amber-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <FormLabel label="Fecha de caducidad" help="Fecha a partir de la cual la tarea dejará de generarse" />
            <input type="date" value={fechaCaducidad} onChange={(e) => setFechaCaducidad(e.target.value)}
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

export default function NuevaTareaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    }>
      <NuevaTareaContent />
    </Suspense>
  );
}
