-- ════════════════════════════════════════════════════════════════════════════
-- BLINDAJE V3 · Supabase Auth + RLS por rol
-- Ejecutar UNA vez en el SQL Editor DESPUÉS de supabase_setup.sql.
--
-- Antes de correr esto, en el Dashboard:
--   1. Authentication → Sign In / Providers → Email → DESACTIVAR «Confirm email»
--      (los usuarios entran con contraseña temporal, sin correo de confirmación).
--   2. Authentication → URL Configuration → Site URL:
--      https://soytorresllamas.github.io/planeacion-servicios-pedagogicos/
--   3. Authentication → Users → «Add user» → crear al PRIMER administrador
--      (correo real, contraseña, marcar Auto Confirm). Anotar su correo y
--      ponerlo abajo en el paso BOOTSTRAP.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Tabla de usuarios de la app (la identidad vive en auth.users) ────────
create table if not exists public.psp_usuarios (
  id             uuid primary key references auth.users (id) on delete cascade,
  correo         text not null unique,
  nombre         text not null default '',
  apellido       text not null default '',
  rol            text not null default 'asesor'
                 check (rol in ('admin', 'coordinador', 'logistica', 'asesor')),
  asesor_id      text,                    -- rol asesor: liga con su hoja en psp_planeacion
  fecha_ingreso  date,
  temp_password  boolean not null default true,
  activo         boolean not null default true,
  creado         timestamptz not null default now(),
  ultimo_ingreso timestamptz,
  ingresos       integer not null default 0
);
alter table public.psp_usuarios enable row level security;

-- ── 2 · Funciones de rol (security definer: evitan recursión de RLS) ─────────
create or replace function public.psp_es_usuario_activo()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.psp_usuarios
    where id = auth.uid() and activo
  );
$$;

create or replace function public.psp_es_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.psp_usuarios
    where id = auth.uid() and activo and rol = 'admin'
  );
$$;

-- ── 3 · Trigger: en self-updates nadie se cambia rol/activo/asesor_id ────────
create or replace function public.psp_protege_campos()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if not public.psp_es_admin() then
    if new.rol is distinct from old.rol
       or new.activo is distinct from old.activo
       or new.asesor_id is distinct from old.asesor_id
       or new.correo is distinct from old.correo then
      raise exception 'Campo protegido: solo un administrador puede modificarlo';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists psp_protege_campos on public.psp_usuarios;
create trigger psp_protege_campos
  before update on public.psp_usuarios
  for each row execute function public.psp_protege_campos();

-- ── 4 · Políticas de psp_usuarios ─────────────────────────────────────────────
drop policy if exists "usuarios_select" on public.psp_usuarios;
create policy "usuarios_select" on public.psp_usuarios for select
  to authenticated using (id = auth.uid() or public.psp_es_admin());

drop policy if exists "usuarios_insert" on public.psp_usuarios;
create policy "usuarios_insert" on public.psp_usuarios for insert
  to authenticated with check (public.psp_es_admin());

drop policy if exists "usuarios_update" on public.psp_usuarios;
create policy "usuarios_update" on public.psp_usuarios for update
  to authenticated
  using (id = auth.uid() or public.psp_es_admin())
  with check (id = auth.uid() or public.psp_es_admin());

drop policy if exists "usuarios_delete" on public.psp_usuarios;
create policy "usuarios_delete" on public.psp_usuarios for delete
  to authenticated using (public.psp_es_admin());

-- ── 5 · Cerrar el acceso anónimo y poner políticas por rol ───────────────────
-- Planeación: cualquier usuario ACTIVO autenticado (los 4 roles la editan).
drop policy if exists "psp_planeacion_anon_all" on public.psp_planeacion;
drop policy if exists "planeacion_rw" on public.psp_planeacion;
create policy "planeacion_rw" on public.psp_planeacion for all
  to authenticated
  using (public.psp_es_usuario_activo())
  with check (public.psp_es_usuario_activo());

-- Catálogos (tabla psp_admin, ahora SOLO gerencias/ejecutivos):
-- leen todos los activos; escribe solo el admin.
drop policy if exists "psp_admin_anon_all" on public.psp_admin;
drop policy if exists "admin_select" on public.psp_admin;
create policy "admin_select" on public.psp_admin for select
  to authenticated using (public.psp_es_usuario_activo());
drop policy if exists "admin_write" on public.psp_admin;
create policy "admin_write" on public.psp_admin for all
  to authenticated
  using (public.psp_es_admin())
  with check (public.psp_es_admin());

-- Respaldos: SOLO administradores (contienen todo el tablero).
drop policy if exists "psp_respaldos_anon_all" on public.psp_respaldos;
drop policy if exists "respaldos_admin" on public.psp_respaldos;
create policy "respaldos_admin" on public.psp_respaldos for all
  to authenticated
  using (public.psp_es_admin())
  with check (public.psp_es_admin());

-- Limpia el blob viejo de admin (traía usuarios con hashes; ya no se usa así).
delete from public.psp_admin where id = 'admin-v3';

-- ── 6 · BOOTSTRAP: liga al primer administrador ──────────────────────────────
-- ⚠ EDITA el correo si usaste otro al crear el usuario en Authentication → Users.
insert into public.psp_usuarios (id, correo, nombre, apellido, rol, temp_password, activo, fecha_ingreso)
select id, email, 'Marcelo', 'Torres', 'admin', false, true, current_date
from auth.users
where email = 'marcelo.torres@grupo-sm.com'
on conflict (id) do update set rol = 'admin', activo = true;

-- Verificación rápida (debe devolver 1 fila con rol admin):
select correo, rol, activo from public.psp_usuarios;
