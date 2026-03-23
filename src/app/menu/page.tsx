'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { inicioDia } from '@/lib/inicio-dia';
import Logo from '@/components/Logo';

export default function MenuPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inicioDiaLoading, setInicioDiaLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/');
      else setLoading(false);
    });
  }, [router]);

  const handleInicioDia = async () => {
    setInicioDiaLoading(true);
    setMensaje('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const resultado = await inicioDia(session.user.id);
    setInicioDiaLoading(false);

    if (resultado.errores.length > 0) {
      setMensaje(`⚠️ ${resultado.errores[0]}`);
    } else {
      setMensaje(
        `✅ Papelitos generados: ${resultado.tareasCreadas} tareas, ${resultado.recompensasCreadas} recompensas`
      );
    }
    setTimeout(() => setMensaje(''), 5000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const menuItems = [
    { label: '📷 ESCANEAR TAREAS', href: '/escanear', color: 'bg-indigo-600 hover:bg-indigo-700' },
    { label: '👥 GESTIONAR USUARIOS', href: '/usuarios', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: '📋 GESTIONAR TAREAS', href: '/tareas', color: 'bg-blue-600 hover:bg-blue-700' },
    { label: '🏆 GESTIONAR RECOMPENSAS', href: '/recompensas', color: 'bg-amber-600 hover:bg-amber-700' },
    { label: '📄 GESTIÓN PAPELITOS', href: '/papelitos', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: '⚙️ CONFIGURACIÓN', href: '/configuracion', color: 'bg-gray-600 hover:bg-gray-700' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center p-6 pt-10">
      <Logo />

      <div className="w-full max-w-sm flex flex-col gap-4 mt-10">
        {menuItems.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`w-full ${item.color} text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors`}
          >
            {item.label}
          </button>
        ))}

        <button
          onClick={handleInicioDia}
          disabled={inicioDiaLoading}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors"
        >
          {inicioDiaLoading ? '⏳ Generando...' : '🌅 INICIO DE DÍA'}
        </button>

        {mensaje && (
          <div className="text-center text-sm p-3 rounded-xl bg-white shadow">
            {mensaje}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="mt-8 text-gray-400 hover:text-gray-600 text-sm"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
