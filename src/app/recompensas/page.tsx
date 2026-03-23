'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DefinicionRecompensa, Usuario } from '@/lib/types';
import BackToMenu from '@/components/BackToMenu';

export default function RecompensasPage() {
  const router = useRouter();
  const [recompensas, setRecompensas] = useState<DefinicionRecompensa[]>([]);
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

    const [recompensasRes, usuariosRes] = await Promise.all([
      supabase
        .from('definicion_recompensas')
        .select('*, usuarios(nombre)')
        .eq('casa_id', session.user.id)
        .order('nombre'),
      supabase
        .from('usuarios')
        .select('*')
        .eq('casa_id', session.user.id)
        .order('nombre'),
    ]);

    if (recompensasRes.data) setRecompensas(recompensasRes.data);
    if (usuariosRes.data) setUsuarios(usuariosRes.data);
    setLoading(false);
  };

  const toggleEstado = async (r: DefinicionRecompensa) => {
    await supabase
      .from('definicion_recompensas')
      .update({ estado: !r.estado })
      .eq('id', r.id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta recompensa?')) return;
    await supabase.from('definicion_recompensas').delete().eq('id', id);
    loadData();
  };

  const recompensasFiltradas = recompensas.filter((r) => {
    const matchNombre = !busqueda || r.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchUsuario = !filtroUsuario || r.usuario_id === filtroUsuario;
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
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Gestionar Recompensas</h1>

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

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Recompensa</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Usuario</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">On/Off</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-16">Editar</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-16">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {recompensasFiltradas.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{r.nombre}</td>
                <td className="py-3 px-4 text-gray-500">
                  {r.comun_o_personal === 'comun' ? '👥 Todos' : r.usuarios?.nombre || '-'}
                </td>
                <td className="py-3 px-4 text-center">
                  <div
                    onClick={() => toggleEstado(r)}
                    className={`toggle-switch inline-block ${r.estado ? 'active' : ''}`}
                  />
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => router.push(`/recompensas/nueva?id=${r.id}`)}
                    className="text-indigo-600 hover:text-indigo-800 text-lg"
                  >✏️</button>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-red-500 hover:text-red-700 text-lg"
                  >🗑️</button>
                </td>
              </tr>
            ))}
            {recompensasFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">No hay recompensas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => router.push('/recompensas/nueva')}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-colors"
        >
          + Añadir Recompensa
        </button>
      </div>

      <BackToMenu />
    </div>
  );
}
