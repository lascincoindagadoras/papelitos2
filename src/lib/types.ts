export interface Usuario {
  id: string;
  casa_id: string;
  nombre: string;
  edad: number | null;
  created_at: string;
}

export interface DefinicionTarea {
  id: string;
  casa_id: string;
  nombre: string;
  frecuencia: 'diaria' | 'semanal' | 'mensual' | 'anual';
  dia: number | null;
  semana: number | null;
  mes: number | null;
  anio: number | null;
  definicion: string | null;
  puntos_ok: number;
  puntos_ko: number;
  estado: boolean;
  usuario_id: string | null;
  hora_impresion: 'mañana' | 'tarde' | null;
  fecha_caducidad: string | null;
  created_at: string;
  // joined
  usuarios?: Usuario;
}

export interface MensajeMotivacional {
  id: string;
  casa_id: string;
  texto: string;
  destinatario: 'niños' | 'padres' | null;
  tipo: 'tarea' | 'recompensa' | null;
  created_at: string;
}

export interface TarjetaInformacion {
  id: string;
  posicion: number;
  texto: string;
  created_at: string;
}

export interface PapelitoTarea {
  id: string;
  casa_id: string;
  definicion_tarea_id: string | null;
  usuario_id: string | null;
  nombre: string;
  definicion: string | null;
  hora_impresion: 'mañana' | 'tarde' | null;
  fecha_impresion: string;
  fecha_escaneo: string | null;
  puntos_ok: number;
  puntos_ko: number;
  codigo: string;
  estado_impresion: boolean;
  estado: 'hecha' | 'no_hecha';
  created_at: string;
  // joined
  usuarios?: Usuario;
}

export interface DefinicionRecompensa {
  id: string;
  casa_id: string;
  nombre: string;
  definicion: string | null;
  frecuencia: 'diaria' | 'semanal' | 'mensual' | 'anual' | null;
  duracion: number | null;
  comun_o_personal: 'comun' | 'personal';
  puntos_canjear: number;
  usuario_id: string | null;
  estado: boolean;
  created_at: string;
  // joined
  usuarios?: Usuario;
}

export interface PapelitoRecompensa {
  id: string;
  casa_id: string;
  definicion_recompensa_id: string | null;
  nombre: string;
  definicion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  usuario_id: string | null;
  conseguido: boolean;
  impreso: boolean;
  created_at: string;
  // joined
  usuarios?: Usuario;
}

export interface Ajustes {
  id: string;
  casa_id: string;
  nombre_impresora: string | null;
  hora_manana: string;
  hora_tarde: string;
  created_at: string;
}
