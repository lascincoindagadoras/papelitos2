'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { inicioDia } from '@/lib/inicio-dia';
import Logo from '@/components/Logo';
import InfoCarousel from '@/components/InfoCarousel';

export default function MenuPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inicioDiaLoading, setInicioDiaLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [showCarousel, setShowCarousel] = useState(false);
  const [fechaHora, setFechaHora] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/');
      else setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setFechaHora(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '  ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    );
  }

  const menuItems = [
    { label: '📷 ESCANEAR TAREAS', href: '/escanear', color: 'bg-stone-700 hover:bg-stone-800' },
    { label: '👥 GESTIONAR USUARIOS', href: '/usuarios', color: 'bg-amber-600 hover:bg-amber-700' },
    { label: '📋 GESTIONAR TAREAS', href: '/tareas', color: 'bg-yellow-600 hover:bg-yellow-700' },
    { label: '🏆 GESTIONAR RECOMPENSAS', href: '/recompensas', color: 'bg-orange-500 hover:bg-orange-600' },
    { label: '📄 GESTIÓN PAPELITOS', href: '/papelitos', color: 'bg-amber-800 hover:bg-amber-900' },
    { label: '⚙️ CONFIGURACIÓN', href: '/configuracion', color: 'bg-stone-500 hover:bg-stone-600' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center p-6 pt-10">
      {showCarousel && <InfoCarousel onFinish={() => setShowCarousel(false)} />}
      <Logo onClick={() => setShowCarousel(true)} />
      {fechaHora && (
        <p className="text-sm text-stone-400 mt-2">{fechaHora}</p>
      )}

      <div className="w-full max-w-sm flex flex-col gap-4 mt-10">
        <button
          key="/escanear"
          onClick={() => router.push('/escanear')}
          className="w-full bg-stone-700 hover:bg-stone-800 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors"
        >
          📷 ESCANEAR TAREAS
        </button>

        <button
          onClick={handleInicioDia}
          disabled={inicioDiaLoading}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors"
        >
          {inicioDiaLoading ? '⏳ Generando...' : '🌅 INICIO DE DÍA'}
        </button>

        {mensaje && (
          <div className="text-center text-sm p-3 rounded-xl bg-white shadow">
            {mensaje}
          </div>
        )}

        {menuItems.slice(1).map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`w-full ${item.color} text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors`}
          >
            {item.label}
          </button>
        ))}
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
