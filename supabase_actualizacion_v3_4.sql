-- ════════════════════════════════════════════════════════════════════════════
-- ACTUALIZACIÓN V3.4 · Rol «simulador» (invitado de un solo módulo)
-- Ejecutar UNA vez en el SQL Editor, DESPUÉS de supabase_actualizacion_v3_3.sql.
--
-- Qué agrega:
--   Rol nuevo «simulador»: entra SOLO al Simulador. El Simulador es cálculo
--   100% del lado del cliente (src/data/model.ts) — no lee ni escribe NINGUNA
--   tabla de Supabase, así que este rol NO necesita política de RLS nueva:
--   con leer su propia fila de psp_usuarios (ya cubierto por la policy
--   existente "usuarios_select") le basta para entrar.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.psp_usuarios drop constraint if exists psp_usuarios_rol_check;
alter table public.psp_usuarios add constraint psp_usuarios_rol_check
  check (rol in ('admin', 'coordinador', 'logistica', 'asesor', 'ejecutivo', 'viajes', 'simulador'));

-- Verificación rápida: debe listar los 7 roles válidos (sin filas, solo confirma que el ALTER corrió).
select conname, pg_get_constraintdef(oid) from pg_constraint where conname = 'psp_usuarios_rol_check';
