import { supabase } from './supabase';
import { PapelitoRecompensa, PapelitoTarea } from './types';

/**
 * Verifica si al escanear un papelito de tarea se alcanzan los puntos
 * de alguna recompensa activa. Si se alcanzan, marca la recompensa como conseguida.
 * Retorna las recompensas conseguidas.
 */
export async function verificarRecompensas(
  casaId: string,
  usuarioId: string
): Promise<{ recompensasConseguidas: PapelitoRecompensa[]; errores: string[] }> {
  const errores: string[] = [];
  const recompensasConseguidas: PapelitoRecompensa[] = [];

  // 1. Obtener todos los papelitos de recompensa no conseguidos
  const { data: recompensasPendientes, error: errorRecompensas } = await supabase
    .from('papelito_recompensas')
    .select('*, definicion_recompensas:definicion_recompensa_id(*)')
    .eq('casa_id', casaId)
    .eq('conseguido', false);

  if (errorRecompensas) {
    errores.push('Error obteniendo recompensas: ' + errorRecompensas.message);
    return { recompensasConseguidas, errores };
  }

  for (const recompensa of (recompensasPendientes as (PapelitoRecompensa & { definicion_recompensas: { puntos_canjear: number; comun_o_personal: string } })[]) || []) {
    if (!recompensa.definicion_recompensas) continue;

    const esComun = recompensa.definicion_recompensas.comun_o_personal === 'comun';
    const puntosNecesarios = recompensa.definicion_recompensas.puntos_canjear;

    // Si es personal, solo aplica al usuario del papelito
    // Si la recompensa es personal pero el usuario escaneando no es el asignado, skip
    if (!esComun && recompensa.usuario_id !== usuarioId) continue;

    // 2. Obtener papelitos de tareas en el periodo de la recompensa
    let queryTareas = supabase
      .from('papelito_tareas')
      .select('*')
      .eq('casa_id', casaId)
      .gte('fecha_impresion', recompensa.fecha_inicio)
      .lte('fecha_impresion', recompensa.fecha_fin);

    if (!esComun) {
      // Solo tareas del usuario asignado a la recompensa
      queryTareas = queryTareas.eq('usuario_id', recompensa.usuario_id);
    }

    const { data: tareasPeriodo, error: errorTareas } = await queryTareas;

    if (errorTareas) {
      errores.push('Error obteniendo tareas del periodo: ' + errorTareas.message);
      continue;
    }

    // 3. Calcular puntos
    let puntosTotal = 0;
    for (const tarea of (tareasPeriodo as PapelitoTarea[]) || []) {
      if (tarea.fecha_escaneo) {
        // Tarea hecha: suma puntos_ok
        puntosTotal += tarea.puntos_ok;
      } else {
        // Tarea no hecha: suma puntos_ko (negativos)
        puntosTotal += tarea.puntos_ko;
      }
    }

    // 4. Verificar si se alcanzaron los puntos
    if (puntosTotal >= puntosNecesarios) {
      const { error: errorUpdate } = await supabase
        .from('papelito_recompensas')
        .update({ conseguido: true })
        .eq('id', recompensa.id);

      if (errorUpdate) {
        errores.push(`Error marcando recompensa "${recompensa.nombre}": ${errorUpdate.message}`);
      } else {
        recompensasConseguidas.push(recompensa);
      }
    }
  }

  return { recompensasConseguidas, errores };
}
