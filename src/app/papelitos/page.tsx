'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PapelitoTarea, Usuario } from '@/lib/types';
import { getMXW01Printer } from '@/lib/mxw01-printer';
import BackToMenu from '@/components/BackToMenu';

export default function PapelitosPage() {
  const router = useRouter();
  const [papelitos, setPapelitos] = useState<PapelitoTarea[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [imprimiendo, setImprimiendo] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/'); return; }

    const hoy = new Date().toISOString().split('T')[0];

    const [papelitosRes, usuariosRes] = await Promise.all([
      supabase
        .from('papelito_tareas')
        .select('*, usuarios(nombre)')
        .eq('casa_id', session.user.id)
        .lte('fecha_impresion', hoy)
        .order('fecha_impresion', { ascending: false }),
      supabase
        .from('usuarios')
        .select('*')
        .eq('casa_id', session.user.id)
        .order('nombre'),
    ]);

    if (papelitosRes.data) setPapelitos(papelitosRes.data);
    if (usuariosRes.data) setUsuarios(usuariosRes.data);
    setLoading(false);
  };

  const handleReimprimir = async (papelito: PapelitoTarea) => {
    const printer = getMXW01Printer();
    if (printer.status !== 'ready') {
      alert('Conecta la impresora primero desde Configuración');
      return;
    }

    setImprimiendo(papelito.id);
    try {
      await printer.printPapelito({
        nombre: papelito.nombre,
        definicion: papelito.definicion,
        usuario: papelito.usuarios?.nombre,
        fecha: papelito.fecha_impresion,
        puntos_ok: papelito.puntos_ok,
        puntos_ko: papelito.puntos_ko,
        codigo: papelito.id,
      });
    } catch (err) {
      alert('Error al imprimir: ' + (err instanceof Error ? err.message : 'Error'));
    }
    setImprimiendo(null);
  };

  const papelitosFiltrados = papelitos.filter((p) => {
    const matchNombre = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchUsuario = !filtroUsuario || p.usuario_id === filtroUsuario;
    const matchEstado = !filtroEstado || p.estado === filtroEstado;
    return matchNombre && matchUsuario && matchEstado;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pb-24">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Gestión de Papelitos</h1>

      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="🔍 Buscar tarea..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border-2 border-stone-200 rounded-xl py-2 px-4 focus:border-amber-500 focus:outline-none"
        />
        <select
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="border-2 border-stone-200 rounded-xl py-2 px-4 focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="border-2 border-stone-200 rounded-xl py-2 px-4 focus:border-amber-500 focus:outline-none"
        >
          <option value="">Todos</option>
          <option value="no_hecha">Pendientes</option>
          <option value="hecha">Hechas</option>
        </select>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tarea</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Usuario</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Fecha</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Estado</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Reimprimir</th>
            </tr>
          </thead>
          <tbody>
            {papelitosFiltrados.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{p.nombre}</td>
                <td className="py-3 px-4 text-gray-500">{p.usuarios?.nombre || '-'}</td>
                <td className="py-3 px-4 text-gray-500">{p.fecha_impresion}</td>
                <td className="py-3 px-4 text-center text-xl">
                  {p.estado === 'hecha' ? '✅' : '⏳'}
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => handleReimprimir(p)}
                    disabled={p.estado === 'hecha' || imprimiendo === p.id}
                    className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:cursor-not-allowed text-lg"
                  >
                    🖨️
                  </button>
                </td>
              </tr>
            ))}
            {papelitosFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  No hay papelitos. Pulsa &quot;Inicio de Día&quot; en el menú para generarlos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BackToMenu />
    </div>
  );
}
