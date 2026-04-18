import { supabase } from './supabase';
import { getMXW01Printer } from './mxw01-printer';
import { inicioDia } from './inicio-dia';
import { PapelitoTarea } from './types';

let checking = false;

/**
 * Obtiene la hora actual en zona horaria española (Europe/Madrid) como "HH:MM".
 */
function getSpainTimeHHMM(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD consistente con inicio-dia.ts
 * (usa UTC, igual que new Date().toISOString().split('T')[0])
 */
function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Comprueba si es hora de imprimir papelitos y los imprime automáticamente.
 * Se ejecuta periódicamente desde el componente AutoImpresion.
 *
 * Flujo:
 * 1. Verifica que la impresora esté conectada y lista
 * 2. Carga hora_manana / hora_tarde de los ajustes
 * 3. Si la hora española actual >= alguna de las horas configuradas,
 *    genera papelitos del día (idempotente) y los imprime
 */
export async function checkAndPrintPapelitos(): Promise<{ printed: number; errors: string[] }> {
  if (checking) return { printed: 0, errors: [] };
  checking = true;

  try {
    const printer = getMXW01Printer();
    if (printer.status !== 'ready') {
      return { printed: 0, errors: [] };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { printed: 0, errors: [] };

    const casaId = session.user.id;

    // Cargar ajustes de horarios
    const { data: ajustes } = await supabase
      .from('ajustes')
      .select('hora_manana, hora_tarde')
      .eq('casa_id', casaId)
      .single();

    if (!ajustes) return { printed: 0, errors: [] };

    const horaActual = getSpainTimeHHMM();
    const hoy = getTodayUTC();

    // Determinar qué franjas horarias ya deberían haberse impreso
    const slotsToCheck: string[] = [];
    if (horaActual >= ajustes.hora_manana) slotsToCheck.push('mañana');
    if (horaActual >= ajustes.hora_tarde) slotsToCheck.push('tarde');

    if (slotsToCheck.length === 0) return { printed: 0, errors: [] };

    // Generar papelitos del día si no existen (idempotente)
    await inicioDia(casaId);

    // Buscar papelitos no impresos de hoy en las franjas activas
    const { data: papelitos, error } = await supabase
      .from('papelito_tareas')
      .select('*, usuarios(nombre)')
      .eq('casa_id', casaId)
      .eq('fecha_impresion', hoy)
      .eq('estado_impresion', false)
      .in('hora_impresion', slotsToCheck);

    if (error || !papelitos || papelitos.length === 0) {
      return { printed: 0, errors: error ? [error.message] : [] };
    }

    let printed = 0;
    const errors: string[] = [];

    for (const papelito of papelitos as PapelitoTarea[]) {
      // Verificar que la impresora sigue lista antes de cada impresión
      if (printer.status !== 'ready') break;

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

        // Marcar como impreso
        await supabase
          .from('papelito_tareas')
          .update({ estado_impresion: true })
          .eq('id', papelito.id);

        printed++;
      } catch (err) {
        errors.push(`Error imprimiendo "${papelito.nombre}": ${err instanceof Error ? err.message : 'Error'}`);
        break; // Parar si la impresora falla
      }
    }

    return { printed, errors };
  } finally {
    checking = false;
  }
}
