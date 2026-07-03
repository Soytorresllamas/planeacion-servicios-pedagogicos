# Notas del proyecto · SM · Planeación 2 Campañas

Bitácora de decisiones y aprendizajes acumulados. Antes de tocar el proyecto, lee esto — evita repetir investigación ya hecha o deshacer decisiones deliberadas.

> 📚 **Documentación técnica por módulo** (la lógica/fórmulas de cada uno, qué cambiar sin romper): ver la carpeta [`docs/`](docs/README.md). Este archivo es el panorama general; `docs/` baja al detalle.

## Qué es

App de apoyo al Comité de Negocios para el modelo de campaña SM 2026-2027 (SMART y CORE). Vite + React + TypeScript + Recharts + react-router-dom (`HashRouter`, por eso funciona en GitHub Pages sin config de servidor).

Repo: [Soytorresllamas/sm-campanas-app](https://github.com/Soytorresllamas/sm-campanas-app) · en vivo: https://soytorresllamas.github.io/sm-campanas-app/

## Mapa de archivos

```
src/
  App.tsx            rutas + nav (lazy/Suspense por vista)
  Gate.tsx            gate de contraseña (ver sección Seguridad)
  main.tsx            monta <Gate><HashRouter><App/></HashRouter></Gate>
  vite-env.d.ts       declaraciones de módulos (*.md?raw) + referencia a vite/client
  index.css           design system completo (variables, tipografía, componentes)
  data/
    model.ts          ÚNICA fuente de verdad: volúmenes, curvas, compute() — tipado
    model.test.ts      pruebas de compute() (vitest)
  lib/
    supabase.ts        cliente Supabase (proyecto compartido con otro producto)
    ganttStore.ts       load/save local + remoto para el Gantt
  features/gantt/      lógica del Gantt partida en hooks + componentes (ver sección Gantt)
  pages/
    Simulador.tsx       sliders de escenario, 3 charts, escenarios A/B
    GanttMarketing.tsx  compone los hooks/componentes de features/gantt/
    Streamgraph.tsx     vista "Servicios" — streamgraph de perfiles
    Documentos.tsx      markdown estático (oculto del menú, accesible por #/documentos)
```

## Design system

- Tipografía: **Newsreader** (serif, itálico en h2 y acentos) + **Hanken Grotesk** (UI). Cargadas vía `@import` de Google Fonts en `index.css`.
- Paleta homologada (importante, se corrigió una vez ya):
  - **SMART = familia azul** (`#1F5AA6` uso → `#4A82C4` prof → `#9BBFE8` didácticas / claro)
  - **CORE = familia teal** (`#2C8A7B` → `#63AE9D` → `#AAD0C8`)
  - **El rojo de marca (`--red` / logo SM) vive solo en el chrome** (header, pestaña activa, botones, gate) — **nunca en visualizaciones de datos** (barras, áreas, dots). Esto fue un pedido explícito del usuario; no reintroducir rojo en charts.
  - Dorado (`#B5841C`) = hitos/capacidad/warnings. Morado (`#7A4A86`) = Convención Comercial.
- Tarjetas planas con borde (`border-radius: 14px`, sin sombra), inspiradas en un dashboard hermano (`auditoria-redes-sm`).

## Data model — una sola fuente de verdad

`src/data/model.ts` exporta `SERVICE_PROFILES` (volúmenes reales de colegios por perfil) y `DEF_CURVES` (curvas mensuales por defecto). **Tanto el Simulador como el Streamgraph leen de aquí** — no hay números duplicados. Esto se corrigió después de un bug real (CORE didácticas aparecía como 1500 en un lado y 1745 en otro).

Si agregas un perfil de servicio o cambias un volumen, hazlo en `model.ts` — nunca hardcodees el número en una página.

`compute(state)` calcula coberturas, capacidad, retención/conquista (por campaña, no solo agregado). Tiene **16 pruebas unitarias** en `model.test.ts` (capacidad, volúmenes en cero, retención/conquista por campaña, selección de mes pico, y una prueba de regresión que fija `DEFAULTS.vAdicC === 1745` para que el bug del 1500 no vuelva a colarse). Corre `npm test`.

## Gantt de gestión (`features/gantt/` + `pages/GanttMarketing.tsx`)

Antes era un solo componente de ~500 líneas; ahora está partido en:

- `types.ts` — `Task`, `TrackKey`, `StatusKey`, etc.
- `constants.ts` — `TRACKS`, `STATUS`, `OWNERS`, `MODULES`, `PPD`, `SYNC`.
- `dateUtils.ts` — helpers de fecha (`parse`, `toISO`, `diffDays`, `fmtShort`).
- `seed.ts` — plan sembrado (42 acciones + 3 hitos + 12 dependencias) convertido a fechas reales desde Sep 2026.
- `useHistory.ts` — deshacer genérico (snapshots JSON en un ref; `historySize` es el único estado real, para que la UI pueda mostrar "¿hay algo que deshacer?" sin leer el ref durante el render).
- `useTasks.ts` — estado de tareas **+ catálogos editables de `modules` y `owners`** + sincronización (local instantánea + Supabase con debounce de 700ms) + todas las mutaciones (patch/del/addTask/addDep/removeDep/importJSON/exportCSV/exportJSON/reset/renameModule/addModule/addOwner).
- `useGanttLayout.ts` — dominio de fechas, meses del header, grupos, geometría de barras, flechas de dependencia.
- `useDragResize.ts` — arrastre con Pointer Events **y navegación equivalente por teclado** (ver Accesibilidad).
- `GanttToolbar.tsx`, `GanttRow.tsx`, `GanttArrows.tsx`, `TaskEditor.tsx` — componentes de presentación.
- `pages/GanttMarketing.tsx` — compone todo lo anterior; es la única pieza que sabe de layout de página.

**Dependencias**: campo `dependsOn: string[]` por tarea. Flechas SVG dibujadas a mano (curvas bezier) superpuestas al timeline. **Bug ya resuelto**: las flechas se pintaban por encima de la columna sticky de títulos al hacer scroll horizontal (quirk de `position:sticky` + SVG en contenedor con scroll — el z-index no lo resolvía). Se arregló con `clip-path: inset(0 0 0 {scrollLeft}px)` en el SVG, recalculado en cada scroll. **No tocar ese clip sin volver a probar con scroll horizontal.**

**Persistencia**: local (`localStorage`) instantáneo + remoto (Supabase) con debounce de 700ms. Al cargar, remoto gana si existe. **Sin manejo de conflictos de edición concurrente** — último guardado gana, sin aviso.

**Deshacer**: historial en memoria (ref, hasta 60 pasos) + `historySize` en estado, Ctrl/⌘+Z. Se pierde al recargar (no es un requisito, es una limitación conocida).

**Módulos y responsables editables**: `constants.ts` (`MODULES`, `OWNERS`) ya solo son la semilla por defecto — el catálogo *vivo* es el estado `modules`/`owners` de `useTasks.ts`, persistido junto con `tasks` en el mismo payload (`GanttData` en `lib/ganttStore.ts`: `{tasks, modules, owners}`). En el editor lateral (`TaskEditor.tsx`):
- **Módulo**: select con "+ Nuevo módulo…" (lo agrega al catálogo y lo asigna a la tarea) y un enlace "✎ renombrar" que cambia el nombre para **todas** las tareas de ese módulo, no solo la seleccionada.
- **Responsable**: select con "+ Nuevo responsable…" (se agrega al catálogo, queda disponible para cualquier tarea futura).
- `loadLocal()`/`loadRemote()` en `ganttStore.ts` son compatibles con el formato viejo (arreglo plano de tareas, sin `modules`/`owners`) para no romper tableros guardados antes de este cambio.

## Accesibilidad del Gantt (teclado)

Cada barra/hito es un elemento enfocable (`tabIndex=0`, `role="button"`, `aria-label` descriptivo). Con foco en una barra:
- `←`/`→` mueve la tarea completa 1 día (equivalente a arrastrar el centro).
- `Shift+←`/`Shift+→` cambia la duración moviendo solo el fin (equivalente a arrastrar el borde derecho).
- `Enter`/`Espacio` abre el editor lateral.
- Los hitos (fecha única) solo soportan mover, no redimensionar.

Anillo de foco visible vía `:focus-visible` en `.g-bar`/`.g-mile` (`index.css`). Implementado en `useDragResize.ts` (`nudge`, `onBarKeyDown`) — reutiliza la misma función `applyDelta` que usa el drag con mouse, así que ambos caminos no pueden divergir.

## TypeScript, pruebas, lint — el gate de calidad

- **TypeScript** en todo `src/` (`tsconfig.json`, `strict: true`). `npm run typecheck` → `tsc --noEmit`.
- **Vitest** para pruebas de lógica (`npm test`). Config vive en `vite.config.ts` (usa `defineConfig` de `vitest/config`, no de `vite`, para que el campo `test` tipe bien).
- **ESLint** (flat config en `eslint.config.js`): `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` (incluye las reglas nuevas `react-hooks/refs` y `react-hooks/static-components`, más estrictas que las clásicas — no leas un ref durante el render, no crees componentes dentro de otro componente). `npm run lint`.
- **CI** (`.github/workflows/deploy.yml`): job `gate` (lint + typecheck + test) → `build` → `deploy`. Si el gate falla, no se publica.
- ⚠️ **Advertencia de HMR conocida**: mientras el dev server sigue corriendo y editas archivos con hooks (p. ej. agregar un `useState` a un hook ya montado), React puede mostrar "change in the order of Hooks" de forma transitoria — es un artefacto de React Refresh, no un bug real. Si lo ves, reinicia el dev server (`preview_stop` + `preview_start`) antes de diagnosticar más.

## Seguridad — leer antes de asumir que está protegido

**El gate de contraseña (`Gate.tsx`) protege la UI, no los datos.** Es un hash SHA-256 verificado en el cliente (igual que el patrón de `estrategia-innova`, otro proyecto hermano). La publishable key de Supabase vive en el bundle público y la tabla `sm_campanas_gantt` tiene RLS anónimo abierto (lectura/escritura para cualquiera con la key). Alguien con conocimiento técnico puede leer/escribir el Gantt sin pasar por el gate, pegándole directo a la REST API de Supabase.

Esto se decidió así deliberadamente por velocidad, **no por descuido** — pero sigue siendo la brecha más importante del proyecto (Roadmap #1, no iniciada). Si se necesita seguridad real: Supabase Auth (login por correo del comité) + políticas RLS que exijan `auth.uid()`.

Contraseña actual del gate: `SMcomite2026` (cambiar el hash en `Gate.tsx` si se rota).

## Supabase

- Proyecto **compartido** con otro producto (`estrategia-innova` u otro). **Toda tabla de este proyecto debe ir prefijada `sm_campanas_`** para no chocar — ya existe la convención, respétala si agregas tablas nuevas.
- Tabla actual: `sm_campanas_gantt` (una sola fila, `id='gantt-26-27'`, columna `data jsonb`). Ver `supabase_setup.sql` para el DDL + política RLS.
- Cliente en `src/lib/supabase.ts` con URL + publishable key hardcodeadas (es intencional para una app estática sin build-time env vars — no es un secreto, es una publishable key).
- ⚠️ **Al probar el Gantt manualmente (drag, teclado, etc.) contra este proyecto, el estado queda en la tabla compartida real.** Si haces pruebas, usa el botón "Restablecer" (o `buildSeed()`) para dejar el tablero limpio antes de terminar — no dejes fechas de prueba en la base que usa el comité.

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`): `gate` (lint+typecheck+test) → `build` (`npm run build`, publica `dist/`) → `deploy` a GitHub Pages, en cada push a `main`.

## Convenciones de commit

Mensajes en español, formato: título corto + cuerpo con motivación (el "por qué", no solo el "qué"), termina con `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`. Revisa `git log` para el tono exacto.

## Roadmap — estado

Evaluado y priorizado con el usuario (2026-07-01); los ítems 2, 4, 5, 6 y 8 se completaron el mismo día.

1. **Auth real** (Supabase Auth + RLS por usuario) — la mejora de seguridad más importante. **No iniciada** — pendiente de decisión de UX de login (correos del comité vs. dominio GRUPOSM).
2. ✅ **Pruebas unitarias de `model.ts`** — 16 pruebas en `model.test.ts`, incluida la regresión del bug 1500/1745.
3. Manejo de conflictos de edición concurrente en el Gantt (last-write-wins hoy). **No iniciada.**
4. ✅ **CI gate**: lint + typecheck + test corriendo en Actions antes del build/deploy.
5. ✅ **TypeScript** en todo `src/`, `strict: true`, sin errores.
6. ✅ **Refactor de `GanttMarketing`** — partido en `features/gantt/` (7 hooks/módulos + 4 componentes).
7. Marcado sistemático "planeado vs. real" en curvas/fechas ilustrativas (hoy solo hay notas al pie sueltas). **No iniciada.**
8. ✅ **Accesibilidad del Gantt** — navegación por teclado completa (mover/redimensionar/editar), verificada en navegador.

Pendientes reales: **#1 (auth), #3 (conflictos concurrentes), #7 (marcado planeado vs. real)**. Los tres requieren decisiones de producto (no son solo trabajo técnico) — preguntar al usuario antes de empezar cualquiera.
