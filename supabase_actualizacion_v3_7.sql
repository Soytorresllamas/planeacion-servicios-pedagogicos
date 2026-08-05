-- ACTUALIZACIÓN V3.7 · usuarios reales como fuente de asesores
-- Ejecutar después de supabase_actualizacion_v3_6.sql.

alter table public.psp_asesores add column if not exists activo boolean not null default true;

-- La rama también es un campo protegido del perfil: solo Administración puede
-- cambiarla; el propio asesor no puede convertirse en otra rama.
create or replace function public.psp_protege_campos()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if not public.psp_es_admin() then
    if new.rol is distinct from old.rol
       or new.activo is distinct from old.activo
       or new.asesor_id is distinct from old.asesor_id
       or new.rama_asesor is distinct from old.rama_asesor
       or new.gerencia is distinct from old.gerencia
       or new.correo is distinct from old.correo then
      raise exception 'Campo protegido: solo un administrador puede modificarlo';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.psp_sincroniza_asesor_usuario()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  -- Desactiva la hoja anterior cuando se desvincula, desactiva o cambia de rol.
  if (tg_op = 'DELETE')
     or (old.asesor_id is not null and (
       tg_op = 'UPDATE' and (
         old.asesor_id is distinct from new.asesor_id
         or old.rol is distinct from new.rol
         or old.activo is distinct from new.activo
       )
     )) then
    update public.psp_asesores a
       set activo = exists (
         select 1 from public.psp_usuarios u
          where u.asesor_id = a.id and u.rol = 'asesor' and u.activo
       ),
           updated_at = now()
     where a.id = old.asesor_id;
  end if;

  -- Un usuario asesor activo y vinculado materializa su hoja y su rama.
  if tg_op <> 'DELETE' and new.rol = 'asesor' and new.asesor_id is not null then
    insert into public.psp_asesores (id, nombre, rama, activo, orden, updated_at)
    values (
      new.asesor_id,
      trim(concat_ws(' ', new.nombre, new.apellido)),
      coalesce(new.rama_asesor, 'pedagogica'),
      new.activo,
      coalesce((select max(orden) + 1 from public.psp_asesores), 0),
      now()
    )
    on conflict (id) do update set
      nombre = excluded.nombre,
      rama = excluded.rama,
      activo = excluded.activo,
      updated_at = now();
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists psp_sincroniza_asesor_usuario on public.psp_usuarios;
create trigger psp_sincroniza_asesor_usuario
  after insert or update or delete on public.psp_usuarios
  for each row execute function public.psp_sincroniza_asesor_usuario();

-- Reconciliación inicial: las hojas creadas por BI sin usuario dejan de ser
-- operativas, pero no se borran para no romper referencias históricas.
update public.psp_asesores a
   set activo = exists (
     select 1 from public.psp_usuarios u
      where u.asesor_id = a.id and u.rol = 'asesor' and u.activo
   ),
       rama = coalesce((
         select coalesce(u.rama_asesor, 'pedagogica')
           from public.psp_usuarios u
          where u.asesor_id = a.id and u.rol = 'asesor' and u.activo
          order by u.creado asc limit 1
       ), a.rama, 'pedagogica'),
       updated_at = now();
