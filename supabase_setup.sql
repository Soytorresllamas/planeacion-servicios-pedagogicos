-- Setup de "SM · Planeación de Servicios Pedagógicos" (V3).
-- Ejecutar UNA vez en el Supabase nuevo: SQL Editor → pegar y correr.
-- Después, poner la URL y la publishable key del proyecto en src/lib/supabase.ts.

-- Tablero de planeación (colegios, asesores, alertas, costos capturados).
create table if not exists public.psp_planeacion (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.psp_planeacion enable row level security;

-- Tablero de administración (usuarios, gerencias, ejecutivos comerciales).
create table if not exists public.psp_admin (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.psp_admin enable row level security;

-- ⚠ MAQUETA: acceso anónimo total con la publishable key (el control lo da el
-- login del front). El paso definitivo es Supabase Auth + políticas RLS por rol;
-- al activarlo, se eliminan estas políticas anónimas.
drop policy if exists "psp_planeacion_anon_all" on public.psp_planeacion;
create policy "psp_planeacion_anon_all"
  on public.psp_planeacion for all to anon using (true) with check (true);

drop policy if exists "psp_admin_anon_all" on public.psp_admin;
create policy "psp_admin_anon_all"
  on public.psp_admin for all to anon using (true) with check (true);

-- Respaldos diarios de ambos tableros (un snapshot por día por tabla).
-- La app crea el snapshot en el primer acceso del día, poda los > 30 días y
-- permite restaurar desde Administración → Respaldos.
create table if not exists public.psp_respaldos (
  id          text primary key,        -- '{tabla}-YYYY-MM-DD'
  tabla       text not null,           -- 'planeacion' | 'admin'
  fecha       date not null,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists psp_respaldos_tabla_fecha on public.psp_respaldos (tabla, fecha desc);
alter table public.psp_respaldos enable row level security;

drop policy if exists "psp_respaldos_anon_all" on public.psp_respaldos;
create policy "psp_respaldos_anon_all"
  on public.psp_respaldos for all to anon using (true) with check (true);
