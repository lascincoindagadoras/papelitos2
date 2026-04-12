'use client';
import { useState, type ReactNode } from 'react';

interface Props {
  onFinish: () => void;
}

const tarjetas: ReactNode[] = [
  '¡Bienvenido! Soy CUCLA y te voy a enseñar a usar la aplicación.',
  'Lo primero es crear los usuarios que forman tu familia, en la pantalla "Gestionar usuarios".',
  'Cuando hayas creado los usuarios, crea las tareas que debe hacer cada uno, en la pantalla "Gestionar tareas".',
  'Después crea las recompensas en la pantalla "Gestionar recompensas". Pueden ser individuales o para todos.',
  'Para empezar el día debes pulsar en "Inicio de día" con lo que la app cargará todas las tareas por hacer y las posibles recompensas de ese día.',
  'Cuando llegue la hora de impresión (mañana o tarde) se imprimirán los papelitos de cada uno con las tareas a realizar. Si lo pierdes, puedes reimprimir un papelito en "Gestión de papelitos".',
  'Cuando una tarea haya sido completada, debes escanear el código del papelito en "Escanear tareas". Esto permitirá a la app sumar los puntos al usuario.',
  'Cada tarea tiene puntos OK y puntos KO, que son negativos, si no se hace la tarea te restan los puntos KO que los padres han decidido poner. Se inicia el día con saldo negativo, como si no hubieras hecho ninguna tarea. A medida que se hacen las tareas, se recuperan los puntos KO y se suman los puntos OK.',
  'Cuando los puntos para una recompensa se alcanzan, la aplicación imprimirá un papelito con la recompensa.',
  'Para enlazar con la impresora térmica pincha en "Configuración". También puedes ajustar ahí las horas de impresión.',
  <>Aquí tienes un enlace para acceder a un video donde te explica como hacer una cajita con papel reciclado para guardar los papelitos y recompensas impresas: <a href="https://youtu.be/MeUMckQwe-c" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">ver vídeo</a></>,
  'Si en algún momento tienes alguna duda puedes pinchar en el logo y te volverá a salir toda esta información.',
];

export default function InfoCarousel({ onFinish }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const current = tarjetas[currentIndex];
  const isLast = currentIndex === tarjetas.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="text-sm text-gray-400 mb-2">
            {currentIndex + 1} / {tarjetas.length}
          </div>
          <p className="text-lg text-gray-700 leading-relaxed">{current}</p>
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
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-6 rounded-xl"
            >
              ¡Empezar!
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex(currentIndex + 1)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-6 rounded-xl"
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
