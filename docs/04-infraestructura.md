# 04 · Infraestructura: persistencia, acceso y despliegue

## 1. Supabase (persistencia del Gantt)

**Archivos:** `src/lib/supabase.ts` (cliente) · `src/lib/ganttStore.ts` (load/save) · `supabase_setup.sql` (DDL).

- Proyecto **compartido** con otro producto. **Toda tabla de este proyecto va prefijada `sm_campanas_`** para no chocar. Respeta la convención si agregas tablas.
- Tabla actual: **`sm_campanas_gantt`** — una sola fila (`id = 'gantt-26-27'`, columna `data jsonb`) que guarda `{ tasks, modules, owners }`.
- El cliente lleva la **URL + publishable key** hardcodeadas. **Es intencional** (app estática sin variables de build) y **no es un secreto**: una publishable key es de exposición pública por diseño.
- **RLS abierto (anon):** cualquiera con la key puede leer/escribir. Ver sección de seguridad abajo.
- Si la tabla no existe o falla la red, la app **degrada a `localStorage`** y muestra "Sin conexión · local".

## 2. Gate de acceso (contraseña)

**Archivo:** `src/Gate.tsx`. Envuelve toda la app.

- Es un **hash SHA-256 verificado en el cliente**. Contraseña actual: **`SMcomite2026`**.
- Para rotarla: genera el hash con
  `node -e "console.log(require('crypto').createHash('sha256').update('NUEVA').digest('hex'))"`
  y pégalo en `PASS_HASH`.
- ⚠️ **Protege la UI, no los datos.** El gate no cifra nada del lado del servidor y la publishable key vive en el bundle público → alguien técnico puede leer/escribir el Gantt pegándole directo a la REST API de Supabase, sin pasar por el gate. Para seguridad real haría falta **Supabase Auth + RLS por `auth.uid()`** (roadmap #1, la brecha más importante del proyecto). Se decidió así **por velocidad**, no por descuido.

## 3. Despliegue (GitHub Actions → GitHub Pages)

**Archivo:** `.github/workflows/deploy.yml`. Corre en cada push a `main`.

Tres jobs en cadena:
1. **`gate`** — `npm install` + `lint` + `typecheck` + `test`. Si falla, no se publica.
2. **`build`** — `npm run build` → sube `dist/` como artefacto de Pages.
3. **`deploy`** — `actions/deploy-pages` publica el artefacto.

### Decisiones y trampas ya vividas (no las revivas)
- **`npm install`, no `npm ci`, y Node 22.** Con `npm ci` + Node 20 el runner fallaba con "Missing esbuild@… from lock file": un desajuste entre el npm 11.x local (que escribe el lockfile) y el npm 10.x del runner para los paquetes de plataforma de esbuild — **no** un lockfile corrupto. `npm install` evita esa validación estricta. Node 22 además es el mínimo que pide `@supabase/supabase-js`.
- **`concurrency: cancel-in-progress: false`.** Con `true`, los despliegues que se encolaban/traslapaban se cancelaban entre sí ("Deployment cancelled"). La plantilla oficial de Pages usa `false` justo por eso.
- **Warnings de "Node.js 20 deprecated"** en las actions (`checkout@v4`, `setup-node@v4`, etc.): son **ruido informativo**, no fallos. v4 es la versión actual; GitHub las corre en Node 24. No hay nada que "arreglar" hasta que salga v5.

### Cuando el deploy falla pero gate+build pasan
Casi siempre es un **incidente de GitHub Pages**, no del código. Síntoma: el paso `deploy` repite `Current status: deployment_queued` varios minutos y muere con `Timeout reached, aborting`.
- **Verifica que sea de GitHub:** `curl -s https://www.githubstatus.com/api/v2/summary.json` y busca el componente **Pages**. Si dice `degraded_performance` o hay un incidente "investigating", **es de ellos**.
- **Qué hacer:** esperar a que se resuelva y **re-disparar** el deploy: `gh workflow run "Deploy a GitHub Pages" --ref main` (o re-run del job fallido). El sitio sigue sirviendo la versión anterior mientras tanto (no se rompe).
- **No** sirve reintentar en ráfaga durante el incidente: cada intento tarda ~10 min en fallar.

## 4. El comando local para no romper CI
Antes de cualquier push:
```
npm run typecheck && npm run lint && npm test && npm run build
```
Todo verde = el `gate` de CI pasará.

## Guardado por filas (V3.3 · revisión de estabilidad)

El tablero dejó de vivir en un solo blob. Medición que motivó el cambio: con el
catálogo real (~1,368 colegios) cada guardado subía **1.7 MB** y dos usuarios
concurrentes se pisaban (last-write-wins del blob completo).

- **Tablas**: `psp_colegios`, `psp_asesores`, `psp_alertas` (data jsonb + `orden`).
  La lectura pagina de 1,000 en 1,000 (límite de PostgREST) y ensambla el
  `PlaneacionData` de siempre; las páginas no cambiaron su forma de trabajar.
- **Escritura**: `usePersistenciaPlaneacion` detecta qué cambió con
  `detectarCambios` (diff **por identidad**: toda mutación del tablero es
  inmutable por `map`, lo no tocado conserva su referencia) y upserta solo esas
  filas (~2 KB). Import/regenerar/restaurar = reemplazo total: upsert de todo lo
  nuevo PRIMERO y borrado de sobrantes al final (nunca hay hueco destructivo).
- **Conflictos**: se reducen a dos personas editando el MISMO colegio en la misma
  ventana de ~1 s (antes: cualquier par de ediciones simultáneas en todo el tablero).
- **Fallo de red**: lo no guardado se re-encola y reintenta con el siguiente
  cambio; el espejo local ya tiene todo y el estatus muestra «Sin conexión · local».
- **Blob legado** (`psp_planeacion`): solo lectura; fallback de arranque si las
  tablas nuevas aún no existen y archivo del estado pre-migración.
- **Trampa de despliegue**: el SQL v3.3 (tablas + RLS + migración) debe correrse
  ANTES del deploy que lo usa; entre ambos (~3 min) no conviene editar el tablero,
  porque la app vieja ya no puede escribir el blob (queda de solo lectura) y la
  nueva aún no está publicada.
