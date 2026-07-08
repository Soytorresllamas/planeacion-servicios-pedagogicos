# 05 · Planeación de servicios pedagógicos (hojas de asesores)

**Estado:** **Fases 1-3 implementadas** (generación + asignación + hoja del asesor + resumen/reconciliación). Pendiente solo lo opcional: timeline tipo Gantt y carga CSV. (rama `nueva-logica`)
**Archivos:** `src/data/planeacion.ts` (lógica pura + tipos) · `src/data/planeacion.test.ts` (pruebas) · `src/lib/planeacionStore.ts` (Supabase, tabla `sm_campanas_planeacion`) · `src/pages/Planeacion.tsx` (UI) · lee la matriz de tipos de `src/data/model.ts`.

Es la capa **operativa** debajo del Simulador. El Simulador planea en **agregado** ("se necesitan X servicios en Y colegios, con esta capacidad"); esta hoja baja al **quién ejecuta**: a cada **asesor empleado** se le asignan colegios y él registra el avance servicio por servicio.

---

## 1. Decisiones de diseño (tomadas con el usuario, jul 2026)

| Tema | Decisión |
|---|---|
| Origen de colegios | **Cupos generados** desde los conteos del Simulador (anónimos), **listos para carga CSV** después. |
| Asignación | **100% manual** (el coordinador decide), con **selección múltiple** para asignar en tandas. |
| Unidad del tablero | **Tarjeta por colegio** (adentro sus servicios requeridos). |
| Acceso | **Herramienta central**: eliges al asesor y ves/editas su hoja. **Sin login por persona** (consistente con la arquitectura actual; ver [`04-infraestructura.md`](04-infraestructura.md)). |

---

## 2. Modelo de datos

```ts
type Campaign = 'SMART' | 'CORE';
type TierKey  = 'top' | 'alto' | 'medio' | 'bajo';   // de model.ts
type Estatus  = 'pendiente' | 'agendado' | 'realizado';

interface Servicio {
  tipo: 'uso' | 'prof' | 'didac';
  estatus: Estatus;
  fechaPlan?: string;   // ISO 'YYYY-MM-DD'
  fechaReal?: string;
  nota?: string;
}

interface Colegio {          // "cupo": anónimo hoy, con nombre real tras CSV
  id: string;                // estable (p.ej. 'SMART-top-001') → clave para el CSV
  nombre: string;            // editable; el CSV lo sobreescribe
  campaign: Campaign;
  tier: TierKey;
  asesorId: string | null;   // null = sin asignar (lo cubren externos)
  servicios: Servicio[];     // congelados al generar (ver §3)
  serie?: string;            // catálogo SERIES (Acierta, Revuela Up…)
  ingles?: string;           // catálogo INGLES (Bright Sparks, Winglish…)
  satisfaccion?: number;     // 1-5 (caritas SATISFACCION); undefined = sin calificar
  notasGenerales?: string;
}
```
> ⚠️ **Catálogos placeholder:** `SERIES` e `INGLES` en `planeacion.ts` traen solo ejemplos; **falta cargar el catálogo real de SM**. La satisfacción usa `SATISFACCION` (5 caritas 😠🙁😐🙂😄).
```

interface Asesor { id: string; nombre: string; }

interface PlaneacionData {    // payload único en Supabase
  asesores: Asesor[];
  colegios: Colegio[];
}
```

---

## 3. Servicios requeridos: se **heredan** del tipo (fuente única)

El "criterio de volumen y segmentación" **no se captura a mano**. Cuando se genera un cupo de tipo `T` en la campaña `C`, sus `servicios` salen de la **matriz de tipos del Simulador** (`model.ts`): `tiers[T]` da cuántos `uso`, `prof` y `didac` requiere ese colegio (Top → 3-2-1, etc.).

> ⚠️ **Se congela al generar.** Los `servicios` se materializan y **se guardan** en el cupo. Si alguien luego edita la matriz en el Simulador, las hojas ya generadas **no cambian solas** (el plan operativo debe ser estable). Para re-alinear, se regeneran los cupos. Esto es deliberado: evita que el avance ya registrado se corrompa por un cambio de supuestos.

---

## 4. Generación de cupos y **escala**

Los conteos del Simulador dan **~2,482 cupos** (413 SMART + 2,069 CORE, repartidos por la mezcla % de cada campaña). Renderizar eso como tarjetas es inviable. Estrategia:

- Los conteos por tipo usan **restos mayores** (`repartirColegios`): siempre suman exactamente el total de la campaña. ⚠️ No regreses a `Math.round` por tipo — perdía/inventaba colegios (SMART 321→320, CORE 1047→1048); hay prueba de regresión.
- El **pool** de colegios sin asignar se muestra como **lista compacta filtrable** (campaña + tipo), nunca como 2,482 tarjetas.
- Las **tarjetas** (pesadas) se renderizan **solo para el asesor seleccionado**.
- Generar es idempotente por `id`: regenerar respeta asignaciones/estatus existentes por `id` cuando sea posible.
- Un control decide cuántos cupos generar (por defecto, los del Simulador); no todos tienen que asignarse: lo **no asignado = externos**.

---

## 5. Pantallas (MVP)

1. **Asignación (coordinador).** Catálogo de asesores con su **carga** (servicios asignados vs. capacidad/mes del Simulador). Pool filtrable con **selección múltiple** → "Asignar a [asesor]" / "Quitar". Contadores asignado / sin asignar / total.
2. **Hoja del asesor.** Selector de asesor → **tarjetas** de sus colegios. Cada tarjeta: nombre · campaña · tipo, y sus `servicios` con **toggle de estatus** (pendiente→agendado→realizado) y fechas **planeada/real**. **Barra de avance** (X/Y realizados, desglosado por tipo).
3. **Resumen.** Avance % por asesor y global, pendientes, quién está **sobrecargado** (asignado > capacidad).

---

## 6. Reconciliación con el Simulador

Un bloque de control que compara, para no perder el hilo con la planeación agregada:

- **Servicios asignados** (Σ de los cupos con asesor) **vs. capacidad de empleados** (del Simulador) **vs. plan total**.
- Semáforo: verde si lo asignado a empleados ≤ capacidad; aviso si se sobrepasa (habría que mandar a externos).
- Recordatorio: los empleados solo cubren **uso/profundización**; las **didácticas siempre son externas** (regla del modelo). En las hojas, las didácticas pueden mostrarse como referencia pero su ejecución es externa.

---

## 7. Persistencia

- Tabla nueva **`sm_campanas_planeacion`** (una fila, `id` fijo, columna `data jsonb` con `PlaneacionData`). Respeta el prefijo `sm_campanas_` (convención del proyecto).
- Mismo patrón que el Gantt (`src/lib/ganttStore.ts`): carga remota gana sobre local, guardado con **debounce**, degradación a `localStorage` si no hay red. Ver [`02-gantt.md`](02-gantt.md) §3 y [`04-infraestructura.md`](04-infraestructura.md) §1.
- ⚠️ **Sin control de edición concurrente** (igual que el Gantt): el último que guarda pisa. Aceptable para el uso actual.

---

## 8. Ruta a CSV (segunda iteración)

El modelo ya queda listo para carga real de colegios:

- CSV con columnas mínimas: `nombre, campaña, tipo` (y opcional `id`, `asesor`).
- La carga **reemplaza/mapea** cupos por `id` (o crea nuevos), preservando asignaciones y estatus donde el `id` coincida.
- Al importar, los `servicios` se derivan del `tipo` con la matriz vigente (§3).

---

## 9. Plan de construcción (MVP por fases)

1. ✅ **Generación + asignación (hecha):** tipos, store de Supabase, generación de cupos desde el Simulador, y **asignación por (campaña × tipo) en tandas** — como los cupos son anónimos e intercambiables dentro de un tipo, se asigna "N cupos de SMART-Top a un asesor" en vez de colegio por colegio (más usable y sigue siendo manual). Helpers `asignarPorTipo` / `liberarPorTipo` / `contarPorTipo`.
2. ✅ **Hoja del asesor (hecha):** pestaña «Hoja del asesor». Incluye mejoras de usabilidad:
   - **Resumen de agenda** arriba (vencidos · esta semana · por hacer · % avance) + barra global.
   - Sub-vistas **Por colegio** (tarjetas colapsables) y **Agenda** (todos los servicios aplanados y ordenados por fecha).
   - **Filtros** por estatus (incl. «vencidos»), campaña y tipo.
   - Cada servicio: **checkbox «hecho»** (marca realizado y pone la fecha de hoy automáticamente), estatus, fecha planeada y **fecha real contextual** (oculta si está pendiente), badge/fondo **ámbar** para vencidos, e ✎ **nota** por servicio.
   - Tarjetas a **una sola columna** (evitan el desborde al aparecer la fecha real). Cada tarjeta trae metadatos del colegio: **Serie**, **Inglés**, **Satisfacción** (caritas) y **Notas generales**. Los filtros incluyen también serie / inglés / satisfacción.
   - **Revisión de usabilidad (jul 2026):** búsqueda por nombre + botón «× Limpiar» + estados vacíos con mensaje; **chips de avance por tipo** (Uso 1/3 · Prof 0/2 · Didác 0/1); notas de servicio **visibles inline** (itálicas, clic para editar; Enter/Esc/blur cierra); **Agenda agrupada por mes** («Octubre 2026»… «Sin fecha planeada» al final); badge **EXT** en didácticas (las ejecutan externos, el asesor coordina); fecha **Real solo en realizados**; desmarcar «hecho» **regresa a "agendado"** si hay fecha planeada; lista de asesores con mini-barra de avance y ⚠ de sobrecarga; fila de totales en Asignación; KPI «Próx. 7 días».
   - Helpers puros: `setServicio`, `renombrarColegio`, `patchColegio`, `hoyISO`, `sumarDias`, `urgencia`, `agendaAsesor`, `serviciosDeAsesor`, `repartirColegios`.
   - ⏳ Uso en campo (móvil-first) queda para después. **Pendiente: cargar el catálogo real de `SERIES` e `INGLES`.**

### Portal del asesor (mockup) — `#/mi-hoja`

**Archivo:** `src/pages/HojaAsesor.tsx`. Simula el acceso individual de un asesor: **login propio** (selector de asesor + contraseña de utilería — cualquier contraseña entra) y **solo su hoja**, sin el nav ni las vistas del comité.

- **Rutas y gate:** `App.tsx` oculta el header del comité en `/mi-hoja`; `Gate.tsx` deja pasar `#/mi-hoja` sin la contraseña del comité (el portal trae su propio login). ⚠️ Es un **mockup de UX**: la autenticación real (Supabase Auth + RLS por asesor) sigue siendo el punto #1 del roadmap — hoy cualquier persona con la URL entra.
- **Sesión:** `sessionStorage` (`sm-asesor-sesion-v1`); botón «Salir». Mismos datos y guardado que Planeación (comparten `planeacionStore`).
- **Módulos del dashboard:** KPIs (vencidos · próx. 7 días · por hacer · avance) · **Tu agenda próxima** (siguientes 6 servicios con fecha y botón «✓ Hecho») · **Requieren tu atención** (colegios con vencidos / sin agendar / satisfacción ≤ 2) · **Tu cartera** (SMART/CORE, carga vs capacidad personal, distribución de satisfacción) · **Mis colegios** (tarjetas de ejecución).
- **Alcance del asesor:** edita **ejecución** (estatus, fechas, notas de servicio, satisfacción, notas generales). **No** edita estructura: no renombra colegios ni cambia serie/inglés (se muestran como texto) — eso es del coordinador.
- **Cartera navegable:** buscador por nombre + filtros (estado con vencidos/pendientes/completados, campaña, tipo) con contador «Mostrando X de Y». Tarjetas **colapsadas por defecto salvo la primera** (y el resultado único de una búsqueda se auto-expande).
- **🚨 Caso crítico (FAB):** botón flotante abajo-derecha (también «Reportar caso» dentro de cada tarjeta) → bottom sheet con colegio (de su cartera), tipo de problema (`PROBLEMAS`: materiales/atención/facturación/otros) y descripción. Se guarda como `Alerta` en `PlaneacionData.alertas` (helpers `agregarAlerta`/`atenderAlerta`, testeados) y **el coordinador la ve en Planeación → Resumen** («Alertas de asesores»), donde la marca ✓ Atendida. En una versión real esto además notificaría (correo/push).
- **Móvil-first:** diseñado y verificado a 375px — KPIs 2×2, bottom sheet para el formulario y padding inferior para el FAB.
- **Tarjeta compacta (rediseño de usabilidad):** cada sub-tarea es **una sola línea** (`☐ nombre[+EXT] · fecha contextual · estatus ▾ · ✎`) — la fecha es **Plan** si está pendiente o **Real** si está hecho (prefijo `P`/`R`), única que cabe en móvil y la que importa a la vez. Un **resumen unificado** con **barra segmentada por servicio** (un tramo por sub-tarea, coloreado por estado) + `X/Y hechos` reemplaza la barra vacía + los chips (se ve incluso en tarjetas colapsadas → escaneo de toda la cartera). **Footer tintado**: satisfacción como **control único** (select con caritas) a la izquierda, «🚨 Reportar caso» **secundario** a la derecha. **Notas generales tras disclosure** («▸ Notas generales», con punto si hay contenido) en vez de textarea siempre abierto.
- Acceso desde la herramienta central: enlace «Ver portal del asesor ↗» en la Hoja del asesor de Planeación.
- **Audit de diseño (`impeccable`, jul 2026):** score 13→16/20. Se quitó el borde lateral de color del select de estatus (anti-patrón; detector limpio), se **tokenizaron los colores** a variables de `index.css` (`var(--smart/--core/--gold/--mut/--track/--gold-wash…)`) en `HojaAsesor.tsx` y `Planeacion.tsx` (menos hex sueltos y duplicación), se corrigió contraste de grises finos (a `--mut`), el header de tarjeta pasó a `<button aria-expanded>` (teclado), el modal de alerta ganó `role="dialog"` + `aria-modal` + cierre con Escape, y subieron los targets táctiles. Nuevos tokens en `index.css`: `--gold-wash`, `--track`.
3. ✅ **Resumen + reconciliación (hecha):** pestaña «Resumen» (a pantalla completa); KPIs de avance de lo asignado, tabla de avance por asesor (con barra y aviso de sobrecarga si su uso/prof supera su capacidad individual ≈ `tDay×dWeek×wMonth×12`), y **reconciliación**: uso/prof asignado a empleados vs. capacidad anual (`nAse×tDay×dWeek×wMonth×12`) con semáforo verde/aviso. Helper `avanceAsignado`; `cargaAsesor` ahora separa `usoProf`. La capacidad sale de `DEFAULTS` (consistente con la generación de cupos).
4. *(Después)* línea de tiempo tipo Gantt y **carga CSV**.

Ruta `#/planeacion` con su `NavLink` en `src/App.tsx`. La tabla `sm_campanas_planeacion` está en `supabase_setup.sql`; mientras no se cree, la app **degrada a `localStorage`** ("Sin conexión · local").

---

## 10. Invariantes / reglas a respetar

- La derivación de servicios por tipo usa la **matriz del Simulador** (`model.ts`), no números sueltos. Fuente única.
- Los `servicios` se **congelan** en el cupo al generar (§3); no se recomputan en cada render.
- Prefijo **`sm_campanas_`** en cualquier tabla nueva de Supabase.
- Colores de datos: azul = SMART, teal = CORE (regla global; el rojo/amarillo del Simulador §2 es la única excepción). Para estatus, usa la paleta de `STATUS` del Gantt (`constants.ts`), no rojo arbitrario.
- No renderizar el pool completo como tarjetas (§4).

## 11. Qué NO hace (alcance)

- No hay login por asesor (herramienta central).
- No auto-reparte la asignación (es manual).
- No re-sincroniza servicios ya congelados cuando cambia la matriz (se regenera a propósito).

## 12. Novedades V3.1 (feedback de usuarios, julio 2026)

- **Niveles escolares**: el colegio declara sus niveles (chips Pre/Pri/Sec/Bach en la
  tarjeta; se derivan de las series por nivel si no vienen) y **cada servicio puede
  indicar el nivel que atiende** (select en la fila; badge en las etiquetas).
- **Talleres extra**: coordinación agrega talleres fuera de la matriz del tipo
  (+Uso/+Profundización/+Didáctica en la tarjeta) para casos de excepción. Quedan
  marcados `extra: true` (badge EXTRA), cuentan en carga/capacidad/rentabilidad y son
  los ÚNICOS servicios que se pueden quitar (la matriz congelada nunca se toca).
  Lógica: `agregarServicioExtra` / `quitarServicioExtra` en `data/planeacion.ts`.
- **Contacto del colegio**: nombre, rol, teléfono y correo por colegio (disclosure 📇
  en la tarjeta, editable también desde el portal del asesor; viene en la carga de BI).
- **Enlace del director**: cada tarjeta (modo coordinación) genera/copia/regenera/
  desactiva el enlace público `#/director/<token>` con la pantalla de avance del
  colegio (ver `docs/07` §seguridad y `supabase_actualizacion_v3_1.sql`).
- **Portal del ejecutivo comercial** (`/mis-colegios`): solo lectura; sus colegios
  (match por «Ejecutivo Responsable» normalizado) con énfasis en comentarios del
  asesor, alertas, contacto y próximas sesiones.
