import { supabase } from './supabase';
import { DefinicionTarea, DefinicionRecompensa } from './types';

/**
 * Genera los papelitos de tareas y recompensas para el día de hoy.
 * Se llama al pulsar "INICIO DE DÍA" en el menú.
 */
export async function inicioDia(casaId: string): Promise<{ tareasCreadas: number; recompensasCreadas: number; errores: string[] }> {
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];
  const diaSemana = hoy.getDay() === 0 ? 7 : hoy.getDay(); // 1=Lun, 7=Dom
  const diaMes = hoy.getDate();
  const mesActual = hoy.getMonth() + 1;
  const errores: string[] = [];
  let tareasCreadas = 0;
  let recompensasCreadas = 0;

  // 1. Obtener todas las tareas activas sin caducar
  const { data: tareas, error: errorTareas } = await supabase
    .from('definicion_tareas')
    .select('*')
    .eq('casa_id', casaId)
    .eq('estado', true);

  if (errorTareas) {
    errores.push('Error al obtener tareas: ' + errorTareas.message);
    return { tareasCreadas, recompensasCreadas, errores };
  }

  // 2. Para cada tarea, verificar si corresponde hoy y no existe ya un papelito
  for (const tarea of (tareas as DefinicionTarea[]) || []) {
    // Verificar fecha de caducidad
    if (tarea.fecha_caducidad && tarea.fecha_caducidad < hoyStr) continue;

    const debeCrearse = verificarFrecuencia(tarea, hoy, diaSemana, diaMes, mesActual);
    if (!debeCrearse) continue;

    // Verificar que no existe ya un papelito para esta tarea hoy
    const { data: existente } = await supabase
      .from('papelito_tareas')
      .select('id')
      .eq('definicion_tarea_id', tarea.id)
      .eq('fecha_impresion', hoyStr)
      .limit(1);

    if (existente && existente.length > 0) continue;

    // Crear papelito
    const codigo = generarCodigo();
    const { error: errorInsert } = await supabase.from('papelito_tareas').insert({
      casa_id: casaId,
      definicion_tarea_id: tarea.id,
      usuario_id: tarea.usuario_id,
      nombre: tarea.nombre,
      definicion: tarea.definicion,
      hora_impresion: tarea.hora_impresion,
      fecha_impresion: hoyStr,
      puntos_ok: tarea.puntos_ok,
      puntos_ko: tarea.puntos_ko,
      codigo: codigo,
      estado_impresion: false,
      estado: 'no_hecha',
    });

    if (errorInsert) {
      errores.push(`Error creando papelito para "${tarea.nombre}": ${errorInsert.message}`);
    } else {
      tareasCreadas++;
    }
  }

  // 3. Generar papelitos de recompensas
  const { data: recompensas, error: errorRecompensas } = await supabase
    .from('definicion_recompensas')
    .select('*')
    .eq('casa_id', casaId)
    .eq('estado', true);

  if (errorRecompensas) {
    errores.push('Error al obtener recompensas: ' + errorRecompensas.message);
    return { tareasCreadas, recompensasCreadas, errores };
  }

  for (const recompensa of (recompensas as DefinicionRecompensa[]) || []) {
    const periodos = calcularPeriodoRecompensa(recompensa, hoy);
    if (!periodos) continue;

    const { fechaInicio, fechaFin } = periodos;

    // Si es personal, crear para el usuario asignado
    // Si es común, crear sin usuario asignado (null)
    const usuarioId = recompensa.comun_o_personal === 'personal' ? recompensa.usuario_id : null;

    // Verificar que no existe ya
    let query = supabase
      .from('papelito_recompensas')
      .select('id')
      .eq('definicion_recompensa_id', recompensa.id)
      .eq('fecha_inicio', fechaInicio)
      .eq('fecha_fin', fechaFin);

    if (usuarioId) {
      query = query.eq('usuario_id', usuarioId);
    } else {
      query = query.is('usuario_id', null);
    }

    const { data: existente } = await query.limit(1);
    if (existente && existente.length > 0) continue;

    const { error: errorInsert } = await supabase.from('papelito_recompensas').insert({
      casa_id: casaId,
      definicion_recompensa_id: recompensa.id,
      nombre: recompensa.nombre,
      definicion: recompensa.definicion,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      usuario_id: usuarioId,
      conseguido: false,
      impreso: false,
    });

    if (errorInsert) {
      errores.push(`Error creando recompensa "${recompensa.nombre}": ${errorInsert.message}`);
    } else {
      recompensasCreadas++;
    }
  }

  return { tareasCreadas, recompensasCreadas, errores };
}

function verificarFrecuencia(
  tarea: DefinicionTarea,
  hoy: Date,
  diaSemana: number,
  diaMes: number,
  mesActual: number
): boolean {
  switch (tarea.frecuencia) {
    case 'diaria':
      return true;
    case 'semanal':
      return tarea.dia === diaSemana;
    case 'mensual':
      return tarea.dia === diaMes;
    case 'anual':
      return tarea.dia === diaMes && tarea.mes === mesActual;
    default:
      return false;
  }
}

function calcularPeriodoRecompensa(
  recompensa: DefinicionRecompensa,
  hoy: Date
): { fechaInicio: string; fechaFin: string } | null {
  const duracion = recompensa.duracion || 1;
  const hoyStr = hoy.toISOString().split('T')[0];

  switch (recompensa.frecuencia) {
    case 'diaria': {
      return { fechaInicio: hoyStr, fechaFin: hoyStr };
    }
    case 'semanal': {
      // Start of week (Monday)
      const dayOfWeek = hoy.getDay() === 0 ? 7 : hoy.getDay();
      const inicio = new Date(hoy);
      inicio.setDate(hoy.getDate() - dayOfWeek + 1);
      const fin = new Date(inicio);
      fin.setDate(inicio.getDate() + (duracion * 7) - 1);
      return {
        fechaInicio: inicio.toISOString().split('T')[0],
        fechaFin: fin.toISOString().split('T')[0],
      };
    }
    case 'mensual': {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() + duracion, 0);
      return {
        fechaInicio: inicio.toISOString().split('T')[0],
        fechaFin: fin.toISOString().split('T')[0],
      };
    }
    case 'anual': {
      const inicio = new Date(hoy.getFullYear(), 0, 1);
      const fin = new Date(hoy.getFullYear(), 11, 31);
      return {
        fechaInicio: inicio.toISOString().split('T')[0],
        fechaFin: fin.toISOString().split('T')[0],
      };
    }
    default:
      return null;
  }
}

function generarCodigo(): string {
  return crypto.randomUUID();
}
