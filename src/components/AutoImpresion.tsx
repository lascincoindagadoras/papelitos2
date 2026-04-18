'use client';
import { useEffect, useRef } from 'react';
import { checkAndPrintPapelitos } from '@/lib/auto-impresion';

const CHECK_INTERVAL_MS = 60_000; // Comprobar cada 60 segundos

/**
 * Componente invisible que ejecuta el planificador de impresión automática.
 * Comprueba cada minuto si hay papelitos pendientes de imprimir
 * según las horas configuradas (hora_manana / hora_tarde).
 */
export default function AutoImpresion() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Comprobar inmediatamente al montar
    checkAndPrintPapelitos();

    // Luego comprobar cada minuto
    intervalRef.current = setInterval(() => {
      checkAndPrintPapelitos();
    }, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}
