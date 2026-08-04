-- ACTUALIZACIÓN V3.5 · Gerencias regionales
-- Ejecutar después de supabase_actualizacion_v3_4.sql.
-- Agrega el rol gerente y restringe la lectura de colegios/alertas a su gerencia.

alter table public.psp_usuarios add column if not exists gerencia text;
alter table public.psp_usuarios drop constraint if exists psp_usuarios_rol_check;
alter table public.psp_usuarios add constraint psp_usuarios_rol_check
  check (rol in ('admin', 'coordinador', 'logistica', 'gerente', 'asesor', 'ejecutivo', 'viajes', 'simulador'));

create or replace function public.psp_mi_gerencia()
returns text language sql security definer stable
set search_path = public as $$
  select gerencia from public.psp_usuarios where id = auth.uid() and activo;
$$;

create or replace function public.psp_mi_ejecutivo()
returns text language sql security definer stable
set search_path = public as $$
  select ejecutivo from public.psp_usuarios where id = auth.uid() and activo;
$$;

create or replace function public.psp_colegio_visible(p_colegio_id text)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.psp_colegios c
    where c.id = p_colegio_id
      and (
        public.psp_rol_actual() in ('admin', 'coordinador', 'logistica', 'viajes')
        or (public.psp_rol_actual() = 'gerente' and c.data->>'gerencia' = public.psp_mi_gerencia())
        or (public.psp_rol_actual() = 'ejecutivo' and c.data->>'ejecutivo' = public.psp_mi_ejecutivo())
        or (public.psp_rol_actual() = 'asesor' and c.data->>'asesorId' = public.psp_mi_asesor_id())
      )
  );
$$;

drop policy if exists "colegios_select" on public.psp_colegios;
create policy "colegios_select" on public.psp_colegios for select
  to authenticated using (
    public.psp_rol_actual() in ('admin', 'coordinador', 'logistica', 'viajes')
    or (public.psp_rol_actual() = 'gerente' and data->>'gerencia' = public.psp_mi_gerencia())
    or (public.psp_rol_actual() = 'ejecutivo' and data->>'ejecutivo' = public.psp_mi_ejecutivo())
    or (public.psp_rol_actual() = 'asesor' and data->>'asesorId' = public.psp_mi_asesor_id())
  );

drop policy if exists "alertas_select" on public.psp_alertas;
create policy "alertas_select" on public.psp_alertas for select
  to authenticated using (public.psp_colegio_visible(data->>'colegioId'));

-- Los gerentes solo leen. La escritura de colegios y alertas permanece en los
-- roles operativos existentes.
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
