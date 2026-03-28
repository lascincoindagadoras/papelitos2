'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TarjetaInformacion } from '@/lib/types';

interface Props {
  onFinish: () => void;
}

export default function InfoCarousel({ onFinish }: Props) {
  const [tarjetas, setTarjetas] = useState<TarjetaInformacion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    supabase
      .from('tarjeta_informacion')
      .select('*')
      .order('posicion', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          onFinish();
        } else {
          setTarjetas(data);
        }
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (tarjetas.length === 0) return null;

  const current = tarjetas[currentIndex];
  const isLast = currentIndex === tarjetas.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="text-sm text-gray-400 mb-2">
            {currentIndex + 1} / {tarjetas.length}
          </div>
          <p className="text-lg text-gray-700 leading-relaxed">{current.texto}</p>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-4 py-2"
          >
            ← Anterior
          </button>

          {isLast ? (
            <button
              onClick={onFinish}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl"
            >
              ¡Empezar!
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex(currentIndex + 1)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-xl"
            >
              Siguiente →
            </button>
          )}
        </div>

        <div className="text-right mt-4">
          <button
            onClick={onFinish}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Omitir
          </button>
        </div>
      </div>
    </div>
  );
}
