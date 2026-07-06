// Persistencia de los CATÁLOGOS (gerencias, ejecutivos comerciales) en la
// tabla psp_admin, fila 'catalogos-v3'. Los usuarios ya NO viven aquí: están
// en la tabla psp_usuarios detrás de Supabase Auth (lib/usuariosStore.ts).
// Local versionado + remoto con degradación, mismo patrón que planeacionStore.
import { supabase, PROJECT_REF } from './supabase';
import { defaultCatalogos } from '../data/usuarios';
import type { CatalogosData } from '../data/usuarios';
import { respaldarSiNuevoDia } from './respaldos';

export const ADMIN_TABLE = 'psp_admin';
export const CATALOGOS_ROW = 'catalogos-v3';
const LS_CATALOGOS = 'psp-catalogos-v3';
const SCHEMA_V = 1;

const valid = (p: unknown): p is CatalogosData => {
  const d = p as CatalogosData;
  return !!d && Array.isArray(d.gerencias) && Array.isArray(d.ejecutivos)
    && d.gerencias.every((g) => typeof g === 'string') && d.ejecutivos.every((e) => typeof e === 'string');
};

export const loadLocalCatalogos = (): CatalogosData | null => {
  try {
    const raw = localStorage.getItem(LS_CATALOGOS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; backend?: string; data?: unknown };
    if (parsed && parsed.v === SCHEMA_V && parsed.backend === PROJECT_REF && valid(parsed.data)) return parsed.data;
  } catch { /* noop */ }
  return null;
};

export const saveLocalCatalogos = (data: CatalogosData): void => {
  try { localStorage.setItem(LS_CATALOGOS, JSON.stringify({ v: SCHEMA_V, backend: PROJECT_REF, data })); } catch { /* noop */ }
};

export type LoadCatalogosResult =
  | { data: CatalogosData; source: 'remote' }
  | { data: null; source: 'none'; error?: unknown };

export async function loadRemoteCatalogos(): Promise<LoadCatalogosResult> {
  try {
    const { data, error } = await supabase.from(ADMIN_TABLE).select('data').eq('id', CATALOGOS_ROW).maybeSingle();
    if (error) return { data: null, source: 'none', error };
    const payload = data?.data as unknown;
    if (valid(payload)) {
      void respaldarSiNuevoDia('catalogos', payload); // snapshot diario (solo lo logra un admin, por RLS)
      return { data: payload, source: 'remote' };
    }
    return { data: null, source: 'none' };
  } catch (e) {
    return { data: null, source: 'none', error: e };
  }
}

export async function saveRemoteCatalogos(data: CatalogosData): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const { error } = await supabase.from(ADMIN_TABLE)
      .upsert({ id: CATALOGOS_ROW, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    return { ok: !error, error };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/** Carga inicial: caché local válido o catálogos vacíos. */
export const initialCatalogos = (): CatalogosData => loadLocalCatalogos() ?? defaultCatalogos();
