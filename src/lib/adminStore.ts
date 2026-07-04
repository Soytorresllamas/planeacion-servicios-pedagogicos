// Persistencia del tablero de administración (usuarios, gerencias, ejecutivos):
// local versionado + Supabase (tabla psp_admin) con degradación a local.
// Mismo patrón que planeacionStore.
import { supabase, PROJECT_REF } from './supabase';
import { respaldarSiNuevoDia } from './respaldos';
import { defaultAdminData } from '../data/usuarios';
import type { AdminData } from '../data/usuarios';

export const ADMIN_TABLE = 'psp_admin';
export const ADMIN_ROW = 'admin-v3';
const LS_ADMIN = 'psp-admin-v3';
const SCHEMA_V = 1;

const valid = (p: unknown): p is AdminData => {
  const d = p as AdminData;
  return !!d && Array.isArray(d.usuarios) && Array.isArray(d.gerencias) && Array.isArray(d.ejecutivos)
    && d.usuarios.every((u) => !!u && typeof u === 'object' && typeof u.correo === 'string');
};

export const loadLocalAdmin = (): AdminData | null => {
  try {
    const raw = localStorage.getItem(LS_ADMIN);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; backend?: string; data?: unknown };
    // Descarta caché de otra versión o de otro backend (evita mezclar usuarios).
    if (parsed && parsed.v === SCHEMA_V && parsed.backend === PROJECT_REF && valid(parsed.data)) return parsed.data;
  } catch { /* noop */ }
  return null;
};

export const saveLocalAdmin = (data: AdminData): void => {
  try { localStorage.setItem(LS_ADMIN, JSON.stringify({ v: SCHEMA_V, backend: PROJECT_REF, data })); } catch { /* noop */ }
};

export type LoadAdminResult =
  | { data: AdminData; source: 'remote' }
  | { data: null; source: 'none'; error?: unknown };

export async function loadRemoteAdmin(): Promise<LoadAdminResult> {
  try {
    const { data, error } = await supabase.from(ADMIN_TABLE).select('data').eq('id', ADMIN_ROW).maybeSingle();
    if (error) return { data: null, source: 'none', error };
    const payload = data?.data as unknown;
    if (valid(payload) && payload.usuarios.length) {
      void respaldarSiNuevoDia('admin', payload); // snapshot diario (no bloquea la carga)
      return { data: payload, source: 'remote' };
    }
    return { data: null, source: 'none' };
  } catch (e) {
    return { data: null, source: 'none', error: e };
  }
}

export async function saveRemoteAdmin(data: AdminData): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const { error } = await supabase.from(ADMIN_TABLE)
      .upsert({ id: ADMIN_ROW, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    return { ok: !error, error };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/** Carga inicial: local válido, o semilla (admin con contraseña temporal). */
export const initialAdmin = (): AdminData => loadLocalAdmin() ?? defaultAdminData();
