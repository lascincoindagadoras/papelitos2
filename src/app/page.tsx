'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/Logo';
import InfoCarousel from '@/components/InfoCarousel';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'initial' | 'login' | 'register'>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/menu');
      else setCheckingSession(false);
    });
  }, [router]);

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Email o contraseña incorrectos');
    } else {
      router.push('/menu');
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!email || !password) {
      setError('Rellena todos los campos');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setShowCarousel(true);
    }
  };

  const handleCarouselFinish = () => {
    setShowCarousel(false);
    router.push('/menu');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {showCarousel && <InfoCarousel onFinish={handleCarouselFinish} />}

      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <Logo />

        {mode === 'initial' && (
          <div className="w-full flex flex-col gap-4 mt-8">
            <button
              onClick={() => setMode('login')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors"
            >
              INICIAR SESIÓN
            </button>
            <button
              onClick={() => setMode('register')}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors"
            >
              CREAR CUENTA
            </button>
          </div>
        )}

        {(mode === 'login' || mode === 'register') && (
          <div className="w-full flex flex-col gap-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 text-lg focus:border-indigo-500 focus:outline-none transition-colors"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl py-3 px-4 text-lg focus:border-indigo-500 focus:outline-none transition-colors"
                placeholder="••••••"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              onClick={mode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-colors"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'SIGUIENTE' : 'GUARDAR'}
            </button>

            <button
              onClick={() => { setMode('initial'); setError(''); }}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
