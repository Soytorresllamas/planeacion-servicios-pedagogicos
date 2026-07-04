import { createClient } from '@supabase/supabase-js'

// Supabase propio de V3 (cuenta marcelo.torres@grupo-sm.com, jul 2026).
// Tablas psp_* creadas con supabase_setup.sql. La publishable key es de
// exposición pública por diseño; la seguridad real llegará con Auth + RLS.
const URL = 'https://ktmeygeuhyprilkkbfkq.supabase.co'
const KEY = 'sb_publishable_eXw3RIZi0GB6WTgRd8s_Qg_Mqg7rZli'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: false },
})


export const PLANEACION_TABLE = 'psp_planeacion'
export const PLANEACION_ROW = 'planeacion-v3'
