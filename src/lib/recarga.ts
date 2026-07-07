// Recarga que EVITA el index.html cacheado.
// GitHub Pages sirve index.html con cache-control: max-age=600 (10 min), pero
// los chunks con hash se borran en cada deploy. Si un navegador tiene el HTML
// viejo cacheado y pide un chunk ya borrado, un reload normal vuelve a servir el
// MISMO HTML viejo (dentro de los 10 min) → falla igual. Un query único fuerza
// al navegador a re-descargar el HTML con los nombres de chunk del deploy actual.

interface LocParts { pathname: string; search: string; hash: string }

/** URL de recarga con un parámetro de invalidación de caché; preserva el hash
 *  (HashRouter) y cualquier otro query existente (reemplazando solo `v`). */
export function urlRecargaFresca(loc: LocParts, ahora: number = Date.now()): string {
  const params = new URLSearchParams(loc.search)
  params.set('v', String(ahora))
  return `${loc.pathname}?${params.toString()}${loc.hash}`
}

/** Recarga la app forzando HTML fresco (no vuelve al mismo index.html cacheado). */
export function recargarFresca(): void {
  window.location.replace(urlRecargaFresca(window.location))
}
