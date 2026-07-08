# UX system refresh · Diseño

Fecha: 2026-07-08  
Repo: `Soytorresllamas/planeacion-servicios-pedagogicos`

## Objetivo

Elevar la experiencia de uso de la plataforma sin cambiar reglas de negocio, datos ni permisos. El foco es que las pantallas densas se sientan mas consistentes, escaneables y confiables para usuarios internos: administracion, coordinacion, logistica, viajes, asesores y ejecutivos.

## Alcance

1. Crear una capa minima de componentes de UI reutilizables.
2. Redisenar la tarjeta de colegio como pieza central de operacion.
3. Estandarizar filtros, tablas, badges, botones y estados vacios.
4. Mejorar jerarquia tipografica y legibilidad en pantallas densas.
5. Mantener la identidad visual actual: SM rojo para chrome/acciones, SMART azul, CORE teal, dorado para advertencias/capacidad.

Fuera de alcance:

- Cambiar Supabase, RLS, Auth o persistencia.
- Cambiar rutas, permisos o roles.
- Cambiar formulas del simulador, rentabilidad o planeacion.
- Introducir una libreria de componentes externa.
- Redisenar la vista publica del director mas alla de pequenos ajustes de consistencia.

## Principios

- La UI debe servir a la tarea, no competir con ella.
- Densidad si, saturacion no: mas estructura visual, menos elementos sueltos.
- Una accion igual debe verse igual en todas las pantallas.
- Los estados importan: vacio, cargando, error, filtrado, deshabilitado y guardando deben ser visibles.
- Mobile-first solo en portales; desktop-dense para administracion, planeacion, rentabilidad y logistica.

## Arquitectura de UI

Agregar una carpeta `src/ui/` con piezas pequenas y sin logica de negocio:

- `Button`: variantes `primary`, `secondary`, `danger`, `ghost`; tamanos `sm`, `md`; estados `disabled` y `loading`.
- `Badge`: variantes `neutral`, `smart`, `core`, `warning`, `success`, `danger`, `purple`.
- `PageHeader`: titulo, descripcion, estado de sincronizacion y acciones.
- `FilterBar`: contenedor consistente para busqueda, selects, contador y limpiar filtros.
- `KpiCard`: valor, etiqueta, tono y opcionalmente detalle.
- `DataTable`: wrapper visual para tablas con scroll horizontal seguro y empty state.
- `EmptyState`: mensaje corto, detalle opcional y accion.

Estos componentes deben usar clases CSS y tokens existentes. Los estilos inline solo quedan para valores dinamicos inevitables como porcentajes, colores de grafica o `--i` de animacion.

## ColegioCard

La tarjeta actual concentra mucha funcion y debe conservarla, pero con jerarquia mas clara.

Estructura propuesta:

1. Header:
   - chevron, campana, nombre, categoria y satisfaccion;
   - progreso `x/y hechos` y barra segmentada;
   - metadata secundaria en una sola linea.
2. Lista de servicios:
   - cada servicio como fila estable con check, tipo/nivel, fecha, estado y nota;
   - notas y reservas como subfilas suaves;
   - `EXT`, `EXTRA`, `Vencido`, `Proximo` como badges consistentes.
3. Panel de acciones secundarias:
   - satisfaccion, serie, ingles, niveles;
   - talleres extra;
   - enlace del director;
   - contacto;
   - notas generales.

Las acciones secundarias deben parecer herramientas de coordinacion, no competir con el avance de servicios.

## Filtros y tablas

Crear un patron compartido:

- Busqueda al inicio.
- Selects/filtros en fila con wrap.
- Contador visible: `N resultados`.
- Boton `Limpiar` solo cuando hay filtros activos.
- Empty state contextual cuando no hay resultados.
- Tablas dentro de un wrapper con scroll horizontal en movil/tablet.

Aplicar primero en:

- `Rentabilidad`
- `Logistica`
- `Administracion`
- `Planeacion` en la hoja del asesor/coordinador

## Tipografia y color

Mantener fuentes actuales, con ajuste de uso:

- `Newsreader` para H1, hero de director y numeros KPI.
- `Hanken Grotesk` para subtitulos, tablas, labels, controles y texto operativo.
- Reducir serif en encabezados internos donde haya muchas tablas.

Contraste:

- Revisar `--faint` en texto funcional; si comunica dato o accion, usar `--mut` como minimo.
- Mantener rojo fuera de datos salvo excepciones documentadas.

## Accesibilidad

Criterios minimos:

- Todos los botones icon-only tienen `aria-label`.
- Foco visible consistente.
- Inputs y selects no bajan de 16px en mobile.
- Tablas mantienen encabezados claros y no fuerzan overflow de la pagina completa.
- Badges no dependen solo del color: texto corto siempre presente.

## Plan de entrega

### Fase 1: Base

- Agregar componentes UI minimos y CSS asociado.
- Migrar botones, badges, KPI y empty states de forma incremental.
- No tocar logica de negocio.

### Fase 2: Superficies de alto impacto

- Refactor visual de `ColegioCard`.
- Aplicar `FilterBar` y `DataTable` en Logistica y Rentabilidad.
- Ajustar estados vacios y mensajes de filtros.

### Fase 3: Consolidacion

- Aplicar patrones a Administracion y Planeacion.
- Reducir estilos inline repetidos.
- Documentar convenciones en `DESIGN.md` o `docs/`.

## Validacion

Antes de publicar:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- Revisión visual local de:
  - login;
  - `#/director/demo`;
  - `#/dev-card`;
  - pantallas autenticadas cuando haya sesion disponible.

## Riesgos

- `ColegioCard` es compartida entre coordinador y portal del asesor; cambios visuales deben respetar ambos contextos.
- Muchos estilos inline pueden hacer que una migracion masiva sea ruidosa. Mejor migrar por componentes y pantallas.
- No introducir abstracciones que escondan reglas de negocio; los componentes UI deben ser presentacionales.

## Criterios de exito

- La app se siente mas consistente entre modulos.
- La tarjeta de colegio se escanea en menos tiempo.
- Los filtros y tablas se comportan igual en pantallas principales.
- Baja la cantidad de estilo inline en zonas tocadas.
- El gate completo queda verde.
