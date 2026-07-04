import { createClient } from '@supabase/supabase-js'

// Supabase propio de V3 (cuenta marcelo.torres@grupo-sm.com, jul 2026).
// Tablas psp_* creadas con supabase_setup.sql. La publishable key es de
// exposición pública por diseño; la seguridad real llegará con Auth + RLS.
const URL = 'https://ktmeygeuhyprilkkbfkq.supabase.co'
const KEY = 'sb_publishable_eXw3RIZi0GB6WTgRd8s_Qg_Mqg7rZli'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: false },
})

// Ref del proyecto (subdominio de la URL). Se guarda junto al caché local para
// descartarlo si la app cambia de backend: así datos de un Supabase anterior no
// contaminan uno nuevo (L1 de la auditoría).
export const PROJECT_REF = URL.replace(/^https?:\/\//, '').split('.')[0]


export const PLANEACION_TABLE = 'psp_planeacion'
export const PLANEACION_ROW = 'planeacion-v3'
