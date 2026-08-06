-- ACTUALIZACIÓN V3.8 · Mensajería bidireccional por colegio
-- Ejecutar después de supabase_actualizacion_v3_7.sql.
-- Los mensajes son filas inmutables; no se mezclan con notas del colegio.

create table if not exists public.psp_mensajes (
  id text primary key,
  colegio_id text not null,
  autor_id uuid not null references auth.users(id) on delete cascade,
  autor_nombre text not null,
  autor_rol text not null check (autor_rol in ('ejecutivo', 'asesor')),
  rama text not null check (rama in ('pedagogica', 'ingles')),
  servicio_tipo text check (servicio_tipo is null or servicio_tipo in ('uso', 'prof', 'didac')),
  servicio_nivel text check (servicio_nivel is null or servicio_nivel in ('pre', 'pri', 'sec', 'bach')),
  texto text not null check (char_length(btrim(texto)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists psp_mensajes_colegio_fecha on public.psp_mensajes (colegio_id, created_at);
create index if not exists psp_mensajes_autor on public.psp_mensajes (autor_id, created_at);

-- El autor y su rol se toman del perfil autenticado; el cliente no puede
-- suplantar el nombre visible del remitente.
create or replace function public.psp_prepara_mensaje()
returns trigger language plpgsql security definer
set search_path = public as $$
declare p record;
begin
  select nombre, apellido, rol, rama_asesor into p
  from public.psp_usuarios where id = auth.uid() and activo;
  if p.rol is null or p.rol not in ('ejecutivo', 'asesor') then
    raise exception 'Solo ejecutivos y asesores pueden enviar mensajes';
  end if;
  new.autor_id := auth.uid();
  new.autor_rol := p.rol;
  new.autor_nombre := btrim(coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, ''));
  if p.rol = 'asesor' and new.rama is distinct from coalesce(p.rama_asesor, 'pedagogica') then
    raise exception 'El asesor solo puede escribir en su rama';
  end if;
  return new;
end;
$$;

drop trigger if exists psp_prepara_mensaje on public.psp_mensajes;
create trigger psp_prepara_mensaje before insert on public.psp_mensajes
for each row execute function public.psp_prepara_mensaje();

create table if not exists public.psp_mensaje_vistas (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  colegio_id text not null,
  ultimo_visto_at timestamptz not null default now(),
  primary key (usuario_id, colegio_id)
);

-- Incluye ambas ramas: el asesor Inglés también puede ver su colegio.
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
        or (public.psp_rol_actual() = 'asesor' and (
          c.data->>'asesorId' = public.psp_mi_asesor_id()
          or c.data->>'asesorInglesId' = public.psp_mi_asesor_id()
        ))
      )
  );
$$;

alter table public.psp_mensajes enable row level security;
alter table public.psp_mensaje_vistas enable row level security;

drop policy if exists "mensajes_select" on public.psp_mensajes;
create policy "mensajes_select" on public.psp_mensajes for select to authenticated
using (
  public.psp_colegio_visible(colegio_id)
  and (public.psp_rol_actual() <> 'asesor' or rama = public.psp_mi_asesor_rama())
);

drop policy if exists "mensajes_insert" on public.psp_mensajes;
create policy "mensajes_insert" on public.psp_mensajes for insert to authenticated
with check (
  autor_id = auth.uid()
  and public.psp_rol_actual() = autor_rol
  and public.psp_colegio_visible(colegio_id)
  and (
    (public.psp_rol_actual() = 'ejecutivo')
    or (public.psp_rol_actual() = 'asesor' and rama = public.psp_mi_asesor_rama())
  )
);

-- No UPDATE/DELETE: el hilo conserva su historial. Solo administración puede
-- intervenir mediante una operación explícita en el SQL Editor.

drop policy if exists "mensaje_vistas_select" on public.psp_mensaje_vistas;
create policy "mensaje_vistas_select" on public.psp_mensaje_vistas for select to authenticated
using (usuario_id = auth.uid() and public.psp_colegio_visible(colegio_id));

drop policy if exists "mensaje_vistas_insert" on public.psp_mensaje_vistas;
create policy "mensaje_vistas_insert" on public.psp_mensaje_vistas for insert to authenticated
with check (usuario_id = auth.uid() and public.psp_colegio_visible(colegio_id));

drop policy if exists "mensaje_vistas_update" on public.psp_mensaje_vistas;
create policy "mensaje_vistas_update" on public.psp_mensaje_vistas for update to authenticated
using (usuario_id = auth.uid() and public.psp_colegio_visible(colegio_id))
with check (usuario_id = auth.uid() and public.psp_colegio_visible(colegio_id));
