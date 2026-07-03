# 06 · Rentabilidad y carga masiva de colegios

Dos capas nuevas sobre la Planeación (docs/05): el **catálogo real de colegios**
(archivo de BI) y el **módulo de Rentabilidad** con la hoja de la **Responsable
Logística**.

## 1 · Carga masiva de colegios (archivo de BI)

**Dónde:** Planeación → Asignación → panel «Carga masiva de colegios».
**Formatos:** `.xlsx`, `.xls` o `.csv` (UTF-8, delimitador `,` o `;`).
**Plantilla oficial:** `public/plantilla-colegios.xlsx` (descargable desde la app);
la genera `scripts/plantilla-colegios.mjs`.

### Columnas

| Columna | Obligatoria | Valores | Uso en la app |
|---|---|---|---|
| Nombre de Colegio | ✔ | texto | nombre visible en todas las hojas |
| ID en CRM | recomendada | texto | clave interna estable (`crm-…`) |
| Clave de Colegio | — | texto | clave alterna (`cve-…` si no hay ID) |
| **Campaña** | ✔ | SMART / CORE | define campaña (columna **añadida** a la lista de BI: sin ella no se pueden derivar los servicios) |
| Categoría de Colegio | ✔ | Top / Alto / Medio / Bajo (o Tipo 1‑4) | matriz de servicios del Simulador (3/2/1, 2/2/1, 1/1/1, 1/1/0) |
| Valor Real de Colegio | recomendada | número MXN | base del módulo de Rentabilidad |
| Gerencia Responsable | recomendada | texto | filtros/agrupación en Rentabilidad |
| Ejecutivo Responsable | recomendada | nombre | ejecutivo **COMERCIAL**: se guarda como dato del colegio (agrupación «Por ejecutivo» en Rentabilidad); **no** asigna servicios |
| Asesor Pedagógico | recomendada | nombre | el asesor que atiende los servicios: se casa con un asesor existente (sin acentos/caja) o **se crea**, y el colegio queda asignado a él → se propaga a su hoja y a su portal |
| Años de Antigüedad | — | número | contexto |
| Serie Preescolar/Primaria/Secundaria, Bachillerato | — | texto | serie por nivel |
| Inglés Preescolar/Primaria/Secundaria/Bachillerato | — | texto | programa de inglés por nivel |
| Otra Serie | — | texto | series no contempladas |

### Reglas

- La importación **reemplaza** los cupos simulados (confirmación previa). La
  generación del Simulador («Regenerar cupos») sigue disponible mientras BI
  entrega la información.
- Filas sin nombre, campaña o categoría válidas se **omiten** y se reportan con
  número de fila y motivo (como se ve en Excel).
- Encabezados tolerantes: mayúsculas/minúsculas, acentos y variantes comunes
  («Categoría», «categoria de colegio», …). Números aceptan `$`, comas y espacios.
- Los servicios de cada colegio se congelan al importar según campaña+categoría.

## 2 · Módulo de Rentabilidad

**Idea:** el Simulador estima costos **ex-ante** (parámetros `CostInputs`:
didáctica $3,750, traslado $1,500, 40 % de didácticas con traslado); Rentabilidad
captura lo **real ex-post**, servicio por servicio, y lo contrasta con el
**Valor Real** del colegio.

### Lógica

- **Ejecutor** (derivado, no editable):
  - `didac` → **externo** siempre.
  - `uso`/`prof` → **interno** si el colegio tiene asesor asignado; **externo**
    si no (falta de capacidad interna).
- **Costo real de un servicio** = `costoTraslado` (solo si la casilla de
  traslado está marcada) + `costoExterno` (solo para ejecutores externos).
- **Rentabilidad por colegio** = `valorReal − Σ costos`; % = margen / valor.
  Colegios sin Valor Real (p. ej. cupos simulados): acumulan costo pero quedan
  fuera del margen (se marcan «s/valor»).
- **Agregados**: por gerencia, asesor (pedagógico), ejecutivo comercial, campaña
  y categoría (valor y margen solo suman colegios con Valor Real; el costo suma todos).

### Hoja de la Responsable Logística

Vista «Hoja logística» dentro de Rentabilidad. Ve **todos** los servicios del
tablero y captura por fila: traslado (checkbox, sugiere $1,500), costo de
traslado, costo de externo (habilitado solo si el ejecutor es externo; sugiere
$3,750) y nota logística (proveedor, folio…).

Filtros: **asesor** (incluye «Sin asignar»), **colegio** (búsqueda), **gerencia**
y estatus. Muestra el costo total de lo filtrado; pagina de 150 en 150.

Comparte el mismo tablero sincronizado (Supabase `sm_campanas_planeacion`), así
que lo capturado se refleja de inmediato en Planeación y en el análisis.

### Pendientes / siguientes pasos

- Portal propio para la Responsable Logística (login tipo `#/mi-hoja`), si se
  quiere separar del acceso del comité.
- Override manual del ejecutor (p. ej. un uso asignado que terminó dando un externo).
- Comparativo estimado (Simulador) vs real (capturado) por mes.
- Los datos capturados viven en `Servicio.{traslado, costoTraslado, costoExterno, notaLog}`
  y `Colegio.{valorReal, gerencia, …}` — lógica pura en `src/data/planeacion.ts`,
  parseo en `src/lib/importColegios.ts`, pruebas en `src/data/rentabilidad.test.ts`.
