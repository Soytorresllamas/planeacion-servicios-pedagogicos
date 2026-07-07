-- ════════════════════════════════════════════════════════════════════════════
-- ACTUALIZACIÓN V3.2 · Módulo Logística (viajes y hospedaje)
-- Ejecutar UNA vez en el SQL Editor, DESPUÉS de supabase_actualizacion_v3_1.sql.
--
-- Qué agrega:
--   1. Rol nuevo «viajes» (Responsable de Viajes): entra SOLO a la sección
--      Logística y ahí carga los PDFs de reservas (hotel y transporte).
--   2. Bucket privado de Storage «psp-reservas» para esos PDFs (máx 10 MB,
--      solo application/pdf) con RLS: los usuarios activos los LEEN (el asesor
--      descarga su reserva); solo viajes/admin los SUBEN/reemplazan/borran.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Rol «viajes» ──────────────────────────────────────────────────────────
alter table public.psp_usuarios drop constraint if exists psp_usuarios_rol_check;
alter table public.psp_usuarios add constraint psp_usuarios_rol_check
  check (rol in ('admin', 'coordinador', 'logistica', 'asesor', 'ejecutivo', 'viajes'));

-- ¿Puede gestionar reservas? (viajes o admin, activo)
create or replace function public.psp_gestiona_reservas()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.psp_usuarios
    where id = auth.uid() and activo and rol in ('viajes', 'admin')
  );
$$;

-- ── 2 · Bucket de reservas (privado, PDF, 10 MB) ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('psp-reservas', 'psp-reservas', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

-- Políticas sobre storage.objects, acotadas al bucket:
-- leer: cualquier usuario ACTIVO (asesores descargan sus reservas con URL firmada)
drop policy if exists "psp_reservas_select" on storage.objects;
create policy "psp_reservas_select" on storage.objects for select
  to authenticated
  using (bucket_id = 'psp-reservas' and public.psp_es_usuario_activo());

-- subir / reemplazar / borrar: SOLO viajes y admin
drop policy if exists "psp_reservas_insert" on storage.objects;
create policy "psp_reservas_insert" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'psp-reservas' and public.psp_gestiona_reservas());

drop policy if exists "psp_reservas_update" on storage.objects;
create policy "psp_reservas_update" on storage.objects for update
  to authenticated
  using (bucket_id = 'psp-reservas' and public.psp_gestiona_reservas())
  with check (bucket_id = 'psp-reservas' and public.psp_gestiona_reservas());

drop policy if exists "psp_reservas_delete" on storage.objects;
create policy "psp_reservas_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'psp-reservas' and public.psp_gestiona_reservas());

-- Verificación rápida: el bucket debe aparecer con public = false.
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'psp-reservas';
