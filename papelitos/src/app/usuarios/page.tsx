'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/lib/types';
import BackToMenu from '@/components/BackToMenu';

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/'); return; }

    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('casa_id', session.user.id)
      .order('nombre');

    if (data) setUsuarios(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const payload = {
      casa_id: session.user.id,
      nombre: nombre.trim(),
      edad: edad ? parseInt(edad) : null,
    };

    let result;
    if (editingId) {
      result = await supabase.from('usuarios').update(payload).eq('id', editingId);
    } else {
      result = await supabase.from('usuarios').insert(payload);
    }

    if (result.error) {
      setError('Error al guardar: ' + result.error.message);
      return;
    }

    resetForm();
    loadUsuarios();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    await supabase.from('usuarios').delete().eq('id', id);
    loadUsuarios();
  };

  const handleEdit = (u: Usuario) => {
    setEditingId(u.id);
    setNombre(u.nombre);
    setEdad(u.edad?.toString() || '');
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setNombre('');
    setEdad('');
    setError('');
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
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Listado de Usuarios</h1>

      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Nombre</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Edad</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-20">Editar</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 w-20">Eliminar</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{u.nombre}</td>
                <td className="py-3 px-4 text-center text-gray-500">{u.edad || '-'}</td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => handleEdit(u)} className="text-indigo-600 hover:text-indigo-800 text-lg">✏️</button>
                </td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 text-lg">🗑️</button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">No hay usuarios. ¡Añade uno!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Editar Usuario' : 'Añadir Usuario'}</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Edad</label>
                <input
                  type="number"
                  value={edad}
                  onChange={(e) => setEdad(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex gap-3 mt-2">
                <button onClick={resetForm} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl">Cancelar</button>
                <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-colors"
        >
          + Añadir Usuario
        </button>
      </div>

      <BackToMenu />
    </div>
  );
}
