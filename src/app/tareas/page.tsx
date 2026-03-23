'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DefinicionTarea, Usuario } from '@/lib/types';
import BackToMenu from '@/components/BackToMenu';

export default function TareasPage() {
  const router = useRouter();
  const [tareas, setTareas] = useState<DefinicionTarea[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/'); return; }

    const [tareasRes, usuariosRes] = await Promise.all([
      supabase
        .from('definicion_tareas')
        .select('*, usuarios(nombre)')
        .eq('casa_id', session.user.id)
        .order('nombre'),
      supabase
        .from('usuarios')
        .select('*')
        .eq('casa_id', session.user.id)
        .order('nombre'),
    ]);

    if (tareasRes.data) setTareas(tareasRes.data);
    if (usuariosRes.data) setUsuarios(usuariosRes.data);
    setLoading(false);
  };

  const toggleEstado = async (tarea: DefinicionTarea) => {
    await supabase
      .from('definicion_tareas')
      .update({ estado: !tarea.estado })
      .eq('id', tarea.id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea?')) return;
    await supabase.from('definicion_tareas').delete().eq('id', id);
    loadData();
  };

  const tareasFiltradas = tareas.filter((t) => {
    const matchNombre = !busqueda || t.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchUsuario = !filtroUsuario || t.usuario_id === filtroUsuario;
    return matchNombre && matchUsuario;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-24">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Gestionar Tareas</h1>

      {/* Filtros */}
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border-2 border-gray-200 rounded-xl py-2 px-4 focus:border-indigo-500 focus:outline-none"
        />
        <select
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="border-2 border-gray-200 rounded-xl py-2 px-4 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tarea</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Usuario</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">On/Off</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-16">Editar</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-16">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {tareasFiltradas.map((t) => (
              <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{t.nombre}</td>
                <td className="py-3 px-4 text-gray-500">{t.usuarios?.nombre || '-'}</td>
                <td className="py-3 px-4 text-center">
                  <div
                    onClick={() => toggleEstado(t)}
                    className={`toggle-switch inline-block ${t.estado ? 'active' : ''}`}
                  />
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => router.push(`/tareas/nueva?id=${t.id}`)}
                    className="text-indigo-600 hover:text-indigo-800 text-lg"
                  >✏️</button>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-red-500 hover:text-red-700 text-lg"
                  >🗑️</button>
                </td>
              </tr>
            ))}
            {tareasFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">No hay tareas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => router.push('/tareas/nueva')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-colors"
        >
          + Añadir Tarea
        </button>
      </div>

      <BackToMenu />
    </div>
  );
}
