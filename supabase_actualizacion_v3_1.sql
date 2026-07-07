-- ════════════════════════════════════════════════════════════════════════════
-- ACTUALIZACIÓN V3.1 · Feedback de usuarios (julio 2026)
-- Ejecutar UNA vez en el SQL Editor, DESPUÉS de supabase_blindaje.sql.
--
-- Qué agrega:
--   1. Rol nuevo «ejecutivo» (Ejecutivo Comercial): entra a la app y ve SOLO el
--      estatus de sus colegios (columna nueva psp_usuarios.ejecutivo = su nombre
--      tal como viene en «Ejecutivo Responsable» del archivo de BI).
--   2. RPC pública psp_vista_director(token): la pantalla de avance que abre el
--      director de un colegio desde su enlace, SIN cuenta. Devuelve únicamente
--      datos publicables (nunca tier, costos, notas, satisfacción ni valor).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Rol «ejecutivo» ───────────────────────────────────────────────────────
alter table public.psp_usuarios add column if not exists ejecutivo text;

alter table public.psp_usuarios drop constraint if exists psp_usuarios_rol_check;
alter table public.psp_usuarios add constraint psp_usuarios_rol_check
  check (rol in ('admin', 'coordinador', 'logistica', 'asesor', 'ejecutivo'));

-- El trigger de self-updates también protege el campo nuevo (nadie se auto-asigna colegios).
create or replace function public.psp_protege_campos()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if not public.psp_es_admin() then
    if new.rol is distinct from old.rol
       or new.activo is distinct from old.activo
       or new.asesor_id is distinct from old.asesor_id
       or new.ejecutivo is distinct from old.ejecutivo
       or new.correo is distinct from old.correo then
      raise exception 'Campo protegido: solo un administrador puede modificarlo';
    end if;
  end if;
  return new;
end;
$$;

-- ── 2 · Vista pública del director (por token, solo lectura) ─────────────────
-- El enlace lo genera coordinación por colegio (tokenDirector: 32 hex ≈ 128 bits,
-- revocable al borrarlo/regenerarlo). La función es SECURITY DEFINER: lee el
-- tablero saltando la RLS, pero SOLO devuelve el subconjunto publicable del
-- colegio cuyo token coincida. Sin coincidencia (o token corto) → NULL.
-- ⚠ Debe devolver la MISMA forma que datosDirector() en src/data/planeacion.ts.
create or replace function public.psp_vista_director(p_token text)
returns jsonb
language sql
security definer stable
set search_path = public
as $$
  select jsonb_build_object(
    'nombre',      c->>'nombre',
    'campaign',    c->>'campaign',
    'niveles',     coalesce(c->'niveles', '[]'::jsonb),
    'seriesNivel', c->'seriesNivel',
    'inglesNivel', c->'inglesNivel',
    'asesor', (
      select a->>'nombre'
      from jsonb_array_elements(p.data->'asesores') a
      where a->>'id' = c->>'asesorId'
      limit 1
    ),
    'servicios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo',      s->>'tipo',
        'estatus',   s->>'estatus',
        'fechaPlan', s->>'fechaPlan',
        'fechaReal', s->>'fechaReal',
        'nivel',     s->>'nivel',
        'extra',     s->'extra'
      )), '[]'::jsonb)
      from jsonb_array_elements(c->'servicios') s
    )
  )
  from public.psp_planeacion p,
       jsonb_array_elements(p.data->'colegios') c
  where p.id = 'planeacion-v3'
    and length(coalesce(p_token, '')) >= 20
    and c->>'tokenDirector' = p_token
  limit 1;
$$;

-- Cualquiera con el enlace puede consultarla (esa es la gracia); anon incluido.
grant execute on function public.psp_vista_director(text) to anon, authenticated;

-- Verificación rápida: sin token válido devuelve NULL (una fila vacía).
select public.psp_vista_director('token-invalido-de-prueba');
