// Claves de DATOS locales de la app (todas con prefijo psp-).
export const LS_PLANEACION = 'psp-planeacion-v3'

/**
 * Borra TODO el estado local de la app (planeación, administración y cualquier
 * clave psp- futura). La copia sincronizada vive en Supabase, así que al volver
 * a entrar se descarga de nuevo. Lo usa la recuperación del ErrorBoundary.
 */
export function resetLocalData(): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('psp-')) localStorage.removeItem(k)
    }
  } catch { /* noop */ }
}
