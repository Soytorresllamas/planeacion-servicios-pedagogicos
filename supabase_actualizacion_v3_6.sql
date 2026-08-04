-- ACTUALIZACIÓN V3.6 · doble rama de asesores (Pedagógica / Inglés)
-- Ejecutar después de supabase_actualizacion_v3_5.sql.
-- Los valores de la matriz de Inglés son provisionales y viven en el frontend;
-- esta migración solo agrega identidad, asignación y límites de escritura.

alter table public.psp_usuarios add column if not exists rama_asesor text;
alter table public.psp_usuarios drop constraint if exists psp_usuarios_rama_asesor_check;
alter table public.psp_usuarios add constraint psp_usuarios_rama_asesor_check
  check (rama_asesor is null or rama_asesor in ('pedagogica', 'ingles'));

alter table public.psp_asesores add column if not exists rama text not null default 'pedagogica';
alter table public.psp_asesores drop constraint if exists psp_asesores_rama_check;
alter table public.psp_asesores add constraint psp_asesores_rama_check
  check (rama in ('pedagogica', 'ingles'));

create or replace function public.psp_mi_asesor_rama()
returns text language sql security definer stable
set search_path = public as $$
  select coalesce(rama_asesor, 'pedagogica') from public.psp_usuarios where id = auth.uid() and activo;
$$;

drop policy if exists "colegios_select" on public.psp_colegios;
create policy "colegios_select" on public.psp_colegios for select to authenticated using (
  public.psp_rol_actual() in ('admin', 'coordinador', 'logistica', 'viajes')
  or (public.psp_rol_actual() = 'gerente' and data->>'gerencia' = public.psp_mi_gerencia())
  or (public.psp_rol_actual() = 'ejecutivo' and data->>'ejecutivo' = public.psp_mi_ejecutivo())
  or (public.psp_rol_actual() = 'asesor' and (
    data->>'asesorId' = public.psp_mi_asesor_id() or data->>'asesorInglesId' = public.psp_mi_asesor_id()
  ))
);

drop policy if exists "colegios_update" on public.psp_colegios;
create policy "colegios_update" on public.psp_colegios for update to authenticated
  using (
    public.psp_rol_actual() in ('admin', 'coordinador', 'logistica', 'viajes')
    or (public.psp_rol_actual() = 'asesor' and (
      data->>'asesorId' = public.psp_mi_asesor_id() or data->>'asesorInglesId' = public.psp_mi_asesor_id()
    ))
  )
  with check (
    public.psp_rol_actual() in ('admin', 'coordinador', 'logistica', 'viajes')
    or (public.psp_rol_actual() = 'asesor' and (
      data->>'asesorId' = public.psp_mi_asesor_id() or data->>'asesorInglesId' = public.psp_mi_asesor_id()
    ))
  );

-- Defensa de segundo nivel para el guardado por fila del cliente actual:
-- un asesor Inglés puede cambiar únicamente contactoIngles y servicios de rama
-- Inglés; no puede reasignar el colegio ni tocar servicios pedagógicos.
create or replace function public.psp_protege_rama_ingles()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  old_ped jsonb; new_ped jsonb;
begin
  if public.psp_rol_actual() = 'asesor'
     and old.data->>'asesorInglesId' = public.psp_mi_asesor_id()
     and old.data->>'asesorId' is distinct from public.psp_mi_asesor_id() then
    if new.data->>'asesorInglesId' is distinct from old.data->>'asesorInglesId'
       or new.data->>'asesorId' is distinct from old.data->>'asesorId'
       or new.data->>'nombre' is distinct from old.data->>'nombre'
       or new.data->>'ingles' is distinct from old.data->>'ingles'
       or new.data->>'gerencia' is distinct from old.data->>'gerencia'
       or new.data->>'ejecutivo' is distinct from old.data->>'ejecutivo'
       or new.data->>'contacto' is distinct from old.data->>'contacto'
       or new.data->>'notasGenerales' is distinct from old.data->>'notasGenerales'
       or new.data->'servicios' is null then
      raise exception 'Asesor Inglés solo puede actualizar sus servicios y contactoIngles';
    end if;
    old_ped := coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(old.data->'servicios') with ordinality t(x,ord) where x->>'rama' is distinct from 'ingles'), '[]'::jsonb);
    new_ped := coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(new.data->'servicios') with ordinality t(x,ord) where x->>'rama' is distinct from 'ingles'), '[]'::jsonb);
    if old_ped is distinct from new_ped then raise exception 'No puedes modificar servicios pedagógicos'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists psp_protege_rama_ingles on public.psp_colegios;
create trigger psp_protege_rama_ingles before update on public.psp_colegios
for each row execute function public.psp_protege_rama_ingles();
