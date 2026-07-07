-- ════════════════════════════════════════════════════════════════════════════
-- ACTUALIZACIÓN V3.3 · Guardado POR FILAS + RLS granular (revisión de estabilidad)
-- Ejecutar UNA vez en el SQL Editor, DESPUÉS de supabase_actualizacion_v3_2.sql.
-- ⚠ COORDINACIÓN CON EL DEPLOY: corre este SQL primero y avisa; el deploy de la
--   app que usa las tablas nuevas sale inmediatamente después. Entre uno y otro
--   (unos ~3 min) conviene no editar el tablero.
--
-- Qué cambia y por qué:
--   El tablero completo vivía en UNA fila (psp_planeacion): cada guardado subía
--   ~1.7 MB con el catálogo real y dos personas editando a la vez se pisaban
--   (last-write-wins del blob). Ahora cada colegio/asesor/alerta es su PROPIA
--   fila: los guardados pesan ~2 KB, los choques se reducen a editar exactamente
--   el mismo colegio, y la RLS puede por fin ser granular:
--     · el ASESOR solo puede escribir SUS colegios (y no puede reasignarlos)
--     · el EJECUTIVO no puede escribir nada (lectura pura, ahora impuesta por la BD)
--     · alertas: cualquier activo las levanta; solo coordinación/logística/admin atienden
--   El blob viejo queda como archivo de solo lectura (fallback de arranque).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Helpers de perfil (security definer: sin recursión de RLS) ────────────
create or replace function public.psp_rol_actual()
returns text language sql security definer stable
set search_path = public as $$
  select rol from public.psp_usuarios where id = auth.uid() and activo;
$$;

create or replace function public.psp_mi_asesor_id()
returns text language sql security definer stable
set search_path = public as $$
  select asesor_id from public.psp_usuarios where id = auth.uid() and activo;
$$;

-- ── 2 · Tablas por fila ───────────────────────────────────────────────────────
create table if not exists public.psp_colegios (
  id         text primary key,
  data       jsonb not null,
  orden      integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.psp_asesores (
  id         text primary key,
  nombre     text not null,
  orden      integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.psp_alertas (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.psp_colegios enable row level security;
alter table public.psp_asesores enable row level security;
alter table public.psp_alertas  enable row level security;

-- índice para el enlace del director (búsqueda por token)
create index if not exists psp_colegios_token
  on public.psp_colegios ((data->>'tokenDirector'))
  where data->>'tokenDirector' is not null;

-- ── 3 · RLS granular ─────────────────────────────────────────────────────────
-- psp_colegios · leer: todo usuario activo (el ejecutivo consulta, nunca escribe)
drop policy if exists "colegios_select" on public.psp_colegios;
create policy "colegios_select" on public.psp_colegios for select
  to authenticated using (public.psp_es_usuario_activo());

-- insertar/borrar: solo quien opera el catálogo (import, regenerar, restaurar)
drop policy if exists "colegios_insert" on public.psp_colegios;
create policy "colegios_insert" on public.psp_colegios for insert
  to authenticated with check (public.psp_rol_actual() in ('admin', 'coordinador', 'logistica'));

drop policy if exists "colegios_delete" on public.psp_colegios;
create policy "colegios_delete" on public.psp_colegios for delete
  to authenticated using (public.psp_rol_actual() in ('admin', 'coordinador', 'logistica'));

-- actualizar: roles operativos, o el ASESOR si el colegio es suyo — y sin poder
-- reasignárselo a nadie (el WITH CHECK exige que siga siendo suyo).
drop policy if exists "colegios_update" on public.psp_colegios;
create policy "colegios_update" on public.psp_colegios for update
  to authenticated
  using (
    public.psp_rol_actual() in ('admin', 'coordinador', 'logistica', 'viajes')
    or (public.psp_rol_actual() = 'asesor' and data->>'asesorId' = public.psp_mi_asesor_id())
  )
  with check (
    public.psp_rol_actual() in ('admin', 'coordinador', 'logistica', 'viajes')
    or (public.psp_rol_actual() = 'asesor' and data->>'asesorId' = public.psp_mi_asesor_id())
  );

-- psp_asesores · leen activos; escriben admin/coordinación/logística (renombres, altas)
drop policy if exists "asesores_select" on public.psp_asesores;
create policy "asesores_select" on public.psp_asesores for select
  to authenticated using (public.psp_es_usuario_activo());

drop policy if exists "asesores_write" on public.psp_asesores;
create policy "asesores_write" on public.psp_asesores for all
  to authenticated
  using (public.psp_rol_actual() in ('admin', 'coordinador', 'logistica'))
  with check (public.psp_rol_actual() in ('admin', 'coordinador', 'logistica'));

-- psp_alertas · leen activos; las LEVANTA cualquier activo (el asesor desde su
-- portal); atender (update) es de coordinación/logística/admin; borrar, admin.
drop policy if exists "alertas_select" on public.psp_alertas;
create policy "alertas_select" on public.psp_alertas for select
  to authenticated using (public.psp_es_usuario_activo());

drop policy if exists "alertas_insert" on public.psp_alertas;
create policy "alertas_insert" on public.psp_alertas for insert
  to authenticated with check (public.psp_es_usuario_activo());

drop policy if exists "alertas_update" on public.psp_alertas;
create policy "alertas_update" on public.psp_alertas for update
  to authenticated
  using (public.psp_rol_actual() in ('admin', 'coordinador', 'logistica'))
  with check (public.psp_rol_actual() in ('admin', 'coordinador', 'logistica'));

drop policy if exists "alertas_delete" on public.psp_alertas;
create policy "alertas_delete" on public.psp_alertas for delete
  to authenticated using (public.psp_es_admin());

-- ── 4 · MIGRACIÓN: del blob a filas (idempotente) ─────────────────────────────
insert into public.psp_colegios (id, data, orden)
select c.value->>'id', c.value, (c.ordinality - 1)::int
from public.psp_planeacion p,
     jsonb_array_elements(p.data->'colegios') with ordinality as c(value, ordinality)
where p.id = 'planeacion-v3'
on conflict (id) do nothing;

insert into public.psp_asesores (id, nombre, orden)
select a.value->>'id', coalesce(a.value->>'nombre', ''), (a.ordinality - 1)::int
from public.psp_planeacion p,
     jsonb_array_elements(p.data->'asesores') with ordinality as a(value, ordinality)
where p.id = 'planeacion-v3'
on conflict (id) do nothing;

insert into public.psp_alertas (id, data)
select al.value->>'id', al.value
from public.psp_planeacion p,
     jsonb_array_elements(coalesce(p.data->'alertas', '[]'::jsonb)) with ordinality as al(value, ordinality)
where p.id = 'planeacion-v3'
on conflict (id) do nothing;

-- ── 5 · El blob viejo queda de SOLO lectura (archivo/fallback) ────────────────
-- Clientes con la app cacheada (hasta ~10 min tras el deploy) ya no pueden
-- escribirle: verán «Sin conexión · local» en vez de creer que guardaron.
drop policy if exists "planeacion_rw" on public.psp_planeacion;
drop policy if exists "planeacion_solo_lectura" on public.psp_planeacion;
create policy "planeacion_solo_lectura" on public.psp_planeacion for select
  to authenticated using (public.psp_es_usuario_activo());

-- ── 6 · Vista del director v2: ahora lee de las filas ─────────────────────────
create or replace function public.psp_vista_director(p_token text)
returns jsonb
language sql
security definer stable
set search_path = public
as $$
  select jsonb_build_object(
    'nombre',      c.data->>'nombre',
    'campaign',    c.data->>'campaign',
    'niveles',     coalesce(c.data->'niveles', '[]'::jsonb),
    'seriesNivel', c.data->'seriesNivel',
    'inglesNivel', c.data->'inglesNivel',
    'asesor',      (select a.nombre from public.psp_asesores a where a.id = c.data->>'asesorId'),
    'servicios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo',      s->>'tipo',
        'estatus',   s->>'estatus',
        'fechaPlan', s->>'fechaPlan',
        'fechaReal', s->>'fechaReal',
        'nivel',     s->>'nivel',
        'extra',     s->'extra'
      )), '[]'::jsonb)
      from jsonb_array_elements(c.data->'servicios') s
    )
  )
  from public.psp_colegios c
  where length(coalesce(p_token, '')) >= 20
    and c.data->>'tokenDirector' = p_token
  limit 1;
$$;

-- ── Verificación ──────────────────────────────────────────────────────────────
-- Deben coincidir los conteos de filas con lo que traía el blob:
select
  (select count(*) from public.psp_colegios)  as colegios,
  (select count(*) from public.psp_asesores)  as asesores,
  (select count(*) from public.psp_alertas)   as alertas,
  (select jsonb_array_length(data->'colegios') from public.psp_planeacion where id = 'planeacion-v3') as colegios_en_blob;
