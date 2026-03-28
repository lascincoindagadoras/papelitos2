/**
 * Setup script: creates all tables, RLS policies, and triggers
 * in the correct Supabase project using the connection string.
 * Run with: node scripts/setup-db.mjs
 */
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres:las3indagadoras@db.sinnbdujmbzxpqvawmik.supabase.co:5432/postgres';

const SQL = `
-- 1. Usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  edad INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usuarios_select') THEN
    CREATE POLICY usuarios_select ON public.usuarios FOR SELECT USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usuarios_insert') THEN
    CREATE POLICY usuarios_insert ON public.usuarios FOR INSERT WITH CHECK (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usuarios_update') THEN
    CREATE POLICY usuarios_update ON public.usuarios FOR UPDATE USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usuarios' AND policyname='usuarios_delete') THEN
    CREATE POLICY usuarios_delete ON public.usuarios FOR DELETE USING (auth.uid() = casa_id);
  END IF;
END $$;

GRANT ALL ON public.usuarios TO anon, authenticated;

-- 2. Definicion de tareas
CREATE TABLE IF NOT EXISTS public.definicion_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  frecuencia TEXT NOT NULL DEFAULT 'diaria',
  dia INTEGER,
  semana INTEGER,
  mes INTEGER,
  anio INTEGER,
  definicion TEXT,
  puntos_ok INTEGER NOT NULL DEFAULT 0,
  puntos_ko INTEGER NOT NULL DEFAULT 0,
  estado BOOLEAN NOT NULL DEFAULT true,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  hora_impresion TEXT DEFAULT 'mañana',
  fecha_caducidad DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.definicion_tareas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_tareas' AND policyname='tareas_select') THEN
    CREATE POLICY tareas_select ON public.definicion_tareas FOR SELECT USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_tareas' AND policyname='tareas_insert') THEN
    CREATE POLICY tareas_insert ON public.definicion_tareas FOR INSERT WITH CHECK (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_tareas' AND policyname='tareas_update') THEN
    CREATE POLICY tareas_update ON public.definicion_tareas FOR UPDATE USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_tareas' AND policyname='tareas_delete') THEN
    CREATE POLICY tareas_delete ON public.definicion_tareas FOR DELETE USING (auth.uid() = casa_id);
  END IF;
END $$;

GRANT ALL ON public.definicion_tareas TO anon, authenticated;

-- 3. Definicion de recompensas
CREATE TABLE IF NOT EXISTS public.definicion_recompensas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  definicion TEXT,
  frecuencia TEXT DEFAULT 'semanal',
  duracion INTEGER,
  comun_o_personal TEXT NOT NULL DEFAULT 'personal',
  puntos_canjear INTEGER NOT NULL DEFAULT 0,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  estado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.definicion_recompensas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_recompensas' AND policyname='recompensas_select') THEN
    CREATE POLICY recompensas_select ON public.definicion_recompensas FOR SELECT USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_recompensas' AND policyname='recompensas_insert') THEN
    CREATE POLICY recompensas_insert ON public.definicion_recompensas FOR INSERT WITH CHECK (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_recompensas' AND policyname='recompensas_update') THEN
    CREATE POLICY recompensas_update ON public.definicion_recompensas FOR UPDATE USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='definicion_recompensas' AND policyname='recompensas_delete') THEN
    CREATE POLICY recompensas_delete ON public.definicion_recompensas FOR DELETE USING (auth.uid() = casa_id);
  END IF;
END $$;

GRANT ALL ON public.definicion_recompensas TO anon, authenticated;

-- 4. Papelito tareas
CREATE TABLE IF NOT EXISTS public.papelito_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_id UUID NOT NULL,
  definicion_tarea_id UUID REFERENCES public.definicion_tareas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  definicion TEXT,
  hora_impresion TEXT,
  fecha_impresion DATE NOT NULL,
  fecha_escaneo TIMESTAMPTZ,
  puntos_ok INTEGER NOT NULL DEFAULT 0,
  puntos_ko INTEGER NOT NULL DEFAULT 0,
  codigo TEXT NOT NULL,
  estado_impresion BOOLEAN NOT NULL DEFAULT false,
  estado TEXT NOT NULL DEFAULT 'no_hecha',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.papelito_tareas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_tareas' AND policyname='papelito_tareas_select') THEN
    CREATE POLICY papelito_tareas_select ON public.papelito_tareas FOR SELECT USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_tareas' AND policyname='papelito_tareas_insert') THEN
    CREATE POLICY papelito_tareas_insert ON public.papelito_tareas FOR INSERT WITH CHECK (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_tareas' AND policyname='papelito_tareas_update') THEN
    CREATE POLICY papelito_tareas_update ON public.papelito_tareas FOR UPDATE USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_tareas' AND policyname='papelito_tareas_delete') THEN
    CREATE POLICY papelito_tareas_delete ON public.papelito_tareas FOR DELETE USING (auth.uid() = casa_id);
  END IF;
END $$;

GRANT ALL ON public.papelito_tareas TO anon, authenticated;

-- 5. Papelito recompensas
CREATE TABLE IF NOT EXISTS public.papelito_recompensas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_id UUID NOT NULL,
  definicion_recompensa_id UUID REFERENCES public.definicion_recompensas(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  definicion TEXT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  conseguido BOOLEAN NOT NULL DEFAULT false,
  impreso BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.papelito_recompensas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_recompensas' AND policyname='papelito_recompensas_select') THEN
    CREATE POLICY papelito_recompensas_select ON public.papelito_recompensas FOR SELECT USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_recompensas' AND policyname='papelito_recompensas_insert') THEN
    CREATE POLICY papelito_recompensas_insert ON public.papelito_recompensas FOR INSERT WITH CHECK (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_recompensas' AND policyname='papelito_recompensas_update') THEN
    CREATE POLICY papelito_recompensas_update ON public.papelito_recompensas FOR UPDATE USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='papelito_recompensas' AND policyname='papelito_recompensas_delete') THEN
    CREATE POLICY papelito_recompensas_delete ON public.papelito_recompensas FOR DELETE USING (auth.uid() = casa_id);
  END IF;
END $$;

GRANT ALL ON public.papelito_recompensas TO anon, authenticated;

-- 6. Ajustes
CREATE TABLE IF NOT EXISTS public.ajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casa_id UUID NOT NULL UNIQUE,
  nombre_impresora TEXT,
  hora_manana TEXT NOT NULL DEFAULT '08:00',
  hora_tarde TEXT NOT NULL DEFAULT '16:00',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ajustes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ajustes' AND policyname='ajustes_select') THEN
    CREATE POLICY ajustes_select ON public.ajustes FOR SELECT USING (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ajustes' AND policyname='ajustes_insert') THEN
    CREATE POLICY ajustes_insert ON public.ajustes FOR INSERT WITH CHECK (auth.uid() = casa_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ajustes' AND policyname='ajustes_update') THEN
    CREATE POLICY ajustes_update ON public.ajustes FOR UPDATE USING (auth.uid() = casa_id);
  END IF;
END $$;

GRANT ALL ON public.ajustes TO anon, authenticated;

-- 7. Auto-confirm emails
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = now();
  NEW.confirmation_token = '';
  NEW.confirmation_sent_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
CREATE TRIGGER auto_confirm_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NULL)
  EXECUTE FUNCTION public.auto_confirm_email();

-- 8. Auto-create ajustes for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_ajustes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ajustes (casa_id) VALUES (NEW.id) ON CONFLICT (casa_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_ajustes ON auth.users;
CREATE TRIGGER on_auth_user_created_ajustes
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_ajustes();

-- 9. Create ajustes for existing users
INSERT INTO public.ajustes (casa_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT casa_id FROM public.ajustes)
ON CONFLICT (casa_id) DO NOTHING;

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to sinnbdujmbzxpqvawmik');
    await client.query(SQL);
    console.log('All tables, policies, triggers created successfully!');
    
    // Verify
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('usuarios','definicion_tareas','definicion_recompensas','papelito_tareas','papelito_recompensas','ajustes')
      ORDER BY table_name
    `);
    console.log('Tables found:', res.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
