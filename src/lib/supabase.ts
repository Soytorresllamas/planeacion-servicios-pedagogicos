import { createClient } from '@supabase/supabase-js'

// ⚠ PENDIENTE: apuntar al Supabase NUEVO de V3 cuando lo entregue el negocio
// (sustituir URL y publishable key, y correr supabase_setup.sql ahí).
// Mientras tanto se usa el proyecto compartido con tablas psp_* propias.
// La publishable key es de exposición pública por diseño.
// Convivimos con otro proyecto en la misma base: todas nuestras tablas van prefijadas `sm_campanas_`.
const URL = 'https://zrooipzscpkagjdpyxic.supabase.co'
const KEY = 'sb_publishable__6P7PyqfzqJ0ZN9YVYidpg_8BccM_1V'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: false },
})


export const PLANEACION_TABLE = 'psp_planeacion'
export const PLANEACION_ROW = 'planeacion-v3'
