# CONTEXTO — Planeación de Servicios Pedagógicos (V3)

> Documento de recuperación de contexto. Léelo primero para retomar el proyecto
> después de compactar la conversación. Estado al **2026-07-07** (V3.1: feedback
> de usuarios — niveles, talleres extra, vista del director, portal del ejecutivo,
> contacto por colegio).

---

## 1 · Qué es

App web interna de SM México (Comité de Negocios) para el ciclo completo de
**servicios pedagógicos** del modelo 2026-2027, campañas **SMART** y **CORE**.
Cubre: simular capacidad/costos, planear y ejecutar servicios por colegio, medir
**rentabilidad**, y administrar catálogos y **usuarios con roles**.

- **App en vivo:** https://soytorresllamas.github.io/planeacion-servicios-pedagogicos/
- **Repo:** `Soytorresllamas/planeacion-servicios-pedagogicos` (público) · tag `v3.0`
- **Local:** `~/Proyectos/planeacion-servicios-pedagogicos`

### ⚠️ Reglas de oro (no romper)
1. **El repo local NO vive en OneDrive.** OneDrive corrompió los refs `.git` del
   repo V2 (2026-07-03). Mantener V3 en `~/Proyectos`. GitHub es el respaldo real.
2. **Hay dos proyectos hermanos:**
   - **V2** = `sm-campanas-app` (en OneDrive, conserva el **Gantt de marketing**). Sigue viva.
   - **V3** = este repo (SIN Gantt, renombrado a "servicios pedagógicos", con Auth+roles).
3. **El Supabase de V3 NO es visible desde el conector MCP de Claude** (vive en la
   cuenta marcelo.torres@grupo-sm.com, otra org). Los cambios de esquema los corre
   Marcelo en el **SQL Editor** del dashboard (o reconectando el conector a esa cuenta).

---

## 2 · Stack y arquitectura

- **Vite + React + TypeScript** (strict), **HashRouter** (rutas con `#/`), **Recharts**, **Vitest**, ESLint flat.
- **Supabase** para datos + **Auth** (identidad) + **RLS** (autorización). Cliente en `src/lib/supabase.ts`.
- **GitHub Actions**: gate (lint+typecheck+test) → build → deploy a **GitHub Pages** en cada push a `main`.
- **Rutas** (`src/App.tsx`, lazy con `lazyConReintento`): `/simulador`, `/planeacion`, `/rentabilidad`, `/logistica`, `/administracion`, `/mi-hoja` (portal asesor), `/mis-colegios` (portal ejecutivo), `/vista-director/:id` (vista previa interna), `/servicios` y `/documentos` (ocultas, solo admin). **Fuera del login**: `#/director/<token>` (vista pública del director, resuelta en `main.tsx` antes del gate; en dev existe `#/director/demo`).
- **Diseño**: sistema propio en `src/index.css` (variables CSS). Fuentes Newsreader (serif) + Hanken Grotesk (sans). Invariante de color: SMART=azul, CORE=teal, **nunca rojo en datos** (excepción documentada: gráfica 2 del Simulador). Componentes UI en `src/ui/` (NumberTicker, Seg animado, Toaster, Skeleton, ProgressRing).
- **Tipografía responsiva por tokens** (`--fs-badge/caption/meta/body/title/input` en `index.css`): escritorio conserva la densidad (9-13px); en **≤560px** suben al piso accesible (10.5-16px; `--fs-input`=16px evita el auto-zoom de iOS). Al agregar texto en superficies móviles usa `fontSize: 'var(--fs-*)'`, no px sueltos. Arnés visual sin login: `#/dev-card` (solo DEV, `src/dev/DevColegioCard.tsx`).

### Comandos
```bash
cd ~/Proyectos/planeacion-servicios-pedagogicos
npm run dev        # dev en :5184 (config psp-v3-dev en .claude/launch.json)
npm run typecheck && npm run lint && npm run test && npm run build   # gate
```
El preview local apunta al **Supabase real** (mismo config). Node local v25.

---

## 3 · Seguridad (BLINDADA — hito grande cerrado 2026-07-05)

Ya NO hay auth de maqueta ni acceso anónimo. Ver `supabase_blindaje.sql` y `docs/07`.

- **Identidad:** Supabase **Auth** (correo+contraseña, bcrypt, tokens auto-refrescados). Cliente con `storageKey: 'psp-auth-v3'`, `persistSession: true`, `detectSessionInUrl: true` (recuperación de contraseña).
- **Autorización — RLS por rol** en todas las tablas:
  - `psp_planeacion`: cualquier usuario **activo** autenticado (los 4 roles la operan).
  - `psp_admin`: ahora **solo catálogos** (fila `catalogos-v3`); leen activos, escribe admin.
  - `psp_usuarios`: cada quien su fila; el admin todas. **Trigger** impide auto-cambiarse rol/activo/asesor_id/correo.
  - `psp_respaldos`: **solo admin**.
  - Sin sesión válida, la publishable key **no lee ni escribe nada** (verificado: 42501).
- **Altas de usuario:** el admin las crea (`signUp` con **cliente secundario** para no pisar su sesión + inserta fila de perfil). Contraseña temporal visible **una vez** + cambio obligatorio al primer ingreso. **Reset = correo de recuperación** de Supabase.
- **Primer admin:** creado en Dashboard (Authentication → Users) = **marcelo.torres@grupo-sm.com**, ligado por el paso BOOTSTRAP del SQL. **Ya NO existe** la semilla vieja admin@sm.com.mx / SM-2027.
- **Manejo local:** espejos locales versionados y **etiquetados por backend** (`PROJECT_REF`); al **salir se limpian** (equipos compartidos).

### Requisitos de dashboard (ya aplicados)
- Authentication → Email → **Confirm email OFF**.
- Authentication → URL Configuration → **Site URL** = la URL de Pages.

---

## 4 · Datos y persistencia

- **Supabase** URL: `https://ktmeygeuhyprilkkbfkq.supabase.co` (`PROJECT_REF` = `ktmeygeuhyprilkkbfkq`). Publishable key en `supabase.ts` (pública por diseño; la RLS es la que protege).
- **Tablas** (V3.3 · guardado POR FILAS, ver `supabase_actualizacion_v3_3.sql`):
  - `psp_colegios` / `psp_asesores` / `psp_alertas`: **una fila por entidad** (data jsonb + orden). Los guardados suben SOLO lo editado (~2 KB vs 1.7 MB del blob a escala real) y la RLS es granular: el asesor solo escribe SUS colegios (sin poder reasignarlos), el ejecutivo es lectura pura.
  - `psp_planeacion` (fila `planeacion-v3`): blob LEGADO, ahora solo lectura (archivo/fallback de arranque).
  - `psp_admin` (fila `catalogos-v3`): gerencias + ejecutivos comerciales.
  - `psp_usuarios`: perfiles (id=uid de Auth, rol, asesor_id, ejecutivo, activo, uso).
  - `psp_respaldos`: snapshots diarios (id `{tabla}-YYYY-MM-DD`); el de planeación guarda el tablero ENSAMBLADO (mismo formato de siempre → restaurable).
- **Patrón de guardado** (`lib/persistenciaPlaneacion.ts` → `usePersistenciaPlaneacion`, tablero; `lib/persistencia.ts` → `usePersistencia`, catálogos): local inmediato + remoto con **debounce 700ms**, **flush al desmontar**, **no reescribir el estado hidratado**, y para el tablero **diff por identidad** (`detectarCambios` en `data/planeacion.ts`: toda mutación es inmutable por map, así que lo no tocado conserva referencia) → upsert de filas sucias; import/regenerar/restaurar = reemplazo total (upsert primero, borrado de sobrantes después). Lectura remota paginada (PostgREST corta en 1000 filas).
- **Respaldos** (`src/lib/respaldos.ts`): un snapshot por día por tabla (planeacion/usuarios/catalogos), automático en el 1er acceso de un admin, poda a **30 días**, restaurable desde **Administración → Respaldos** (restaurar usuarios exige admin activo; nunca toca contraseñas).
- **Recuperación ante fallos** (`src/ErrorBoundary.tsx` + `src/lib/recarga.ts`): ante un chunk que no descarga tras un deploy, **recarga con caché-busting** (`?v=timestamp`) porque GitHub Pages cachea `index.html` 10 min y borra los chunks viejos.

---

## 5 · Funcionalidad por sección

- **Simulador** (`Simulador.tsx`, modelo puro en `data/model.ts`): coberturas por mes, empleados vs externos, costos. 4 categorías de colegio (Top/Alto/Medio/Bajo) con matriz de servicios (uso/prof/didáctica). Uso/prof = internos si hay capacidad, si no externos; **didácticas siempre externas**.
- **Planeación** (`Planeacion.tsx`): cupos, asignación de colegios a asesores, hoja de seguimiento (tarjeta `features/planeacion/ColegioCard.tsx` compartida con el portal), agenda, alertas. Guardas anti-lockout al renombrar asesores. La tarjeta trae además: **niveles escolares** del colegio (chips; cada servicio puede indicar su nivel), **contacto** del colegio (nombre/rol/tel/correo), **talleres extra** de coordinación (+Uso/+Prof/+Didáctica, marcados EXTRA y quitables) y la gestión del **enlace del director**.
- **Portal del asesor** (`HojaAsesor.tsx`, `#/mi-hoja`, móvil-first): su cartera, agenda, "caso crítico". El asesor entra directo a SU hoja (`sesion.asesorId`); admin/coord/logística lo ven como vista previa.
- **Portal del ejecutivo comercial** (`MisColegios.tsx`, `#/mis-colegios`, SOLO lectura): estatus de los colegios que lo traen como «Ejecutivo Responsable» (match por nombre normalizado vía `colegiosDeEjecutivo`), con énfasis en comentarios/notas del asesor y alertas. Nunca guarda (sin `usePersistencia`, a propósito).
- **Vista del director** (`Director.tsx` + `VistaDirectorPreview.tsx`): pantalla de avance para el CLIENTE FINAL. Coordinación genera por colegio un enlace `#/director/<token>` (32 hex, revocable/regenerable desde la tarjeta del colegio). El director la abre SIN cuenta: `main.tsx` la resuelve antes del gate y consulta el RPC público `psp_vista_director(token)` (security definer). **Nunca viajan** tier, costos, notas internas, satisfacción ni valor (forma definida por `datosDirector`/`normalizarDirector` en `data/planeacion.ts` y espejada en el SQL).
- **Rentabilidad** (`Rentabilidad.tsx`): valor real vs costos (traslados + externos). Hoja logística para la **Responsable Logística** (captura costos, filtros por asesor/colegio/gerencia). Ejecutor derivado: didácticas siempre externas; uso/prof según asignación.
- **Administración** (`Administracion.tsx`, solo admin): Colegios (carga masiva XLS/CSV de BI + valor del colegio), Catálogos (gerencias, ejecutivos comerciales), Usuarios (alta/rol/activo/recuperación), Uso (mapeo de ingresos), Respaldos.
- **Logística** (`Logistica.tsx`, `/logistica`, V3.2): consolidado de servicios agendados con **✈️ viaje / 🏨 hospedaje** (los marca logística en Planeación → agenda; marcar viaje pre-marca `traslado` en Rentabilidad). El rol **viajes** carga los PDFs de reservas (transporte y hotel, por separado) a **Supabase Storage** (bucket privado `psp-reservas`; capa en `lib/reservasStore.ts`); el asesor los abre desde su portal. Ver `docs/08-logistica-viajes.md`.
- **7 roles** (`src/lib/sesion.ts`, cubiertos por `src/lib/sesion.test.ts`): **admin** (todo), **coordinador** y **logistica** (Planeación+Rentabilidad+Logística+vistas previas), **asesor** (solo su hoja), **ejecutivo** (solo `/mis-colegios`, lectura; ligado por `psp_usuarios.ejecutivo` = su nombre en «Ejecutivo Responsable»), **viajes** (solo `/logistica`; único que carga reservas junto con admin), **simulador** (solo `/simulador`, con header/nav normal — no es portal; el Simulador no toca Supabase así que no necesita RLS propia, solo ampliar el CHECK de rol).

### Carga masiva de colegios (archivo de BI)
- Plantilla oficial: `public/plantilla-colegios.xlsx` (genera `scripts/plantilla-colegios.mjs`), descargable desde la app. Parser en `src/lib/importColegios.ts`.
- Distingue **Ejecutivo Responsable** (comercial, solo dato/análisis) del **Asesor Pedagógico** (se vuelve asesor y recibe el colegio). Columna extra requerida: **Campaña** (SMART/CORE).
- **Pendiente de negocio:** BI aún no entrega el catálogo real; hoy corre con cupos simulados del Simulador.

---

## 6 · Estado actual y pendientes

**Hecho:** V3 completa, blindada (Auth+RLS granular por filas), respaldos diarios, favicon, fix de recarga por caché de deploy, semilla real del Simulador (SMART 413 / CORE 2,069), rol «simulador» (v3_4.sql corrido y confirmado). Backend **pristino** listo para datos reales. CI verde. 122 pruebas.

**Pendientes / próximos pasos:**
0. Un alta de «Invitado al Simulador» falló ANTES de correr v3_4 (quedó cuenta en
   Auth sin fila de perfil). Borrar ese correo huérfano en Supabase →
   Authentication → Users y reintentar el alta desde Administración → Usuarios.
1. **Cargar el catálogo real de BI** cuando lo entreguen (activa rentabilidad con valores
   reales). La plantilla ya pide niveles y contacto del colegio.
2. **Dar de alta al equipo** (coordinación, logística, asesores) desde Administración → Usuarios.
3. **Backups off-site**: al pasar Supabase a plan Pro, activar sus backups automáticos (colchón contra pérdida del proyecto entero).
4. Borrar en Supabase → Authentication → Users el usuario de prueba `prueba-rls-borrar@gmail.com` si aparece (inerte, sin acceso).

**Gotcha de deploys:** tras publicar, para agarrar la versión nueva en un navegador con caché, hacer **Cmd+Shift+R** una vez. A partir del fix de recarga, futuros deploys se auto-reparan.

---

## 7 · Documentación detallada

- `docs/01-modelo-y-simulador.md` · `docs/05-planeacion-servicios.md` · `docs/06-rentabilidad.md` · `docs/07-administracion-usuarios.md` (seguridad + respaldos) · `docs/08-logistica-viajes.md` · `docs/04-infraestructura.md`
- `PRESENTACION.md` — panorama divulgativo (base para presentaciones).
- `supabase_setup.sql` (tablas base) + `supabase_blindaje.sql` (Auth + RLS) + `supabase_actualizacion_v3_1.sql` (rol ejecutivo + vista pública del director) + `supabase_actualizacion_v3_2.sql` (rol viajes + bucket de reservas) + `supabase_actualizacion_v3_3.sql` (guardado por filas + RLS granular) + `supabase_actualizacion_v3_4.sql` (rol simulador). Los 4 ya están corridos y confirmados en producción.
