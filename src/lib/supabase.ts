import { createClient } from '@supabase/supabase-js'

// Supabase propio de V3 (cuenta marcelo.torres@grupo-sm.com, jul 2026).
// Identidad en Supabase Auth + RLS por rol (supabase_blindaje.sql): la
// publishable key es pública por diseño, pero sin sesión válida las políticas
// niegan todo acceso a los datos.
export const URL = 'https://ktmeygeuhyprilkkbfkq.supabase.co'
export const KEY = 'sb_publishable_eXw3RIZi0GB6WTgRd8s_Qg_Mqg7rZli'

export const supabase = createClient(URL, KEY, {
  auth: {
    persistSession: true,          // la sesión JWT vive en localStorage y se auto-refresca
    autoRefreshToken: true,
    detectSessionInUrl: true,      // procesa los enlaces de recuperación de contraseña
    storageKey: 'psp-auth-v3',     // prefijo psp-: el reset del ErrorBoundary también la limpia
  },
})

// Ref del proyecto (subdominio de la URL). Se guarda junto al caché local para
// descartarlo si la app cambia de backend: así datos de un Supabase anterior no
// contaminan uno nuevo (L1 de la auditoría).
export const PROJECT_REF = URL.replace(/^https?:\/\//, '').split('.')[0]

export const PLANEACION_TABLE = 'psp_planeacion'
export const PLANEACION_ROW = 'planeacion-v3'
