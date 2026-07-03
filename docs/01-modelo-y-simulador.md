# 01 · Modelo de cálculo y Simulador

**Archivos:** `src/data/model.ts` (toda la lógica, tipada y testeada) · `src/data/model.test.ts` (29 pruebas) · `src/pages/Simulador.tsx` (la UI que lo muestra).

El modelo es la **fuente única de verdad** del proyecto: el Simulador y la vista Servicios/streamgraph leen de aquí. Todo el cálculo vive en `compute(input)` y las semillas en `DEFAULTS`. **Si tocas una fórmula, corre `npm test`** — las pruebas fijan los invariantes.

---

## 1. Modelo por campaña: 2 volúmenes × 3 tipos de servicio

El modelo es **"una vez por campaña"**: hay **un volumen de colegios por campaña** (`vSmart`, `vCore`) y cada colegio recibe uso + profundización + didácticas según sus **servicios/colegio por tipo** (rejilla 2×3). Los servicios se llaman "servicios" (antes "talleres").

| | Volumen (colegios) | Uso | Profund. | Didác. |
|---|---|---|---|---|
| **SMART** | `vSmart` = 321 | `tUsoS` = 3 | `tProfS` = 3 | `tAdicS` = 1 |
| **CORE** | `vCore` = 1047 | `tUsoC` = 3 | `tProfC` = 3 | `tAdicC` = 1 |

`servicios_tipo = volumen_campaña × curva_campaña × servicios/colegio_tipo`.

Total del ciclo con las semillas: **9,576 servicios** = SMART 321×7 (2,247) + CORE 1047×7 (7,329).

> ℹ️ **Simplificación (jul 2026):** antes había 6 volúmenes sueltos por tipo y una curva por tipo. Ahora son **2 volúmenes** (uno por campaña) y **2 curvas de cierre** (una por campaña). Todos los servicios de una campaña comparten su volumen y su curva.

> ⚠️ El **streamgraph** NO usa esta simplificación: sigue leyendo `SERVICE_PROFILES` (6 perfiles con sus propios volúmenes 458/321/160/1745/1047/733) y las curvas por tipo `uso/prof/adicS/adicC` + `Cu/Cp`. Son dos vistas con modelos distintos a propósito; no se sincronizan.

---

## 2. Curvas mensuales (`DEF_CURVES`, `genCurve`, `norm`)

Cada tipo tiene una **curva de 12 meses** (Oct→Sep) que reparte su volumen anual en el tiempo. Las curvas se **normalizan** (`norm`) para que sumen 1: así el total anual = volumen × servicios/colegio, sin importar la forma de la curva.

- `DEF_CURVES` tiene **6 claves con dos propósitos**: `smart`/`core` las usa el **Simulador** (una curva de cierre por campaña, SMART temprana y CORE tardía); `uso`/`prof`/`adicS`/`adicC` las usa el **streamgraph** (curvas por tipo). No se mezclan.
- El panel "Curvas de cierre" del simulador (solo **SMART** y **CORE**) genera curvas gaussianas con `genCurve(focal, spread, win)` y las mete en el estado `curves`.
- **Invariante:** como `norm` normaliza, cambiar la forma de una curva **mueve** los servicios entre meses pero **no cambia** el total anual ni el costo total. Solo cambia los picos.

---

## 3. Cálculo mensual (`compute`, dentro del `for` de 12 meses)

Para cada mes `i`:

`cS = norm(curves.smart)`, `cC = norm(curves.core)` (una curva por campaña).
```
usoT   = vSmart × cS[i] × tUsoS          // Uso SMART
profT  = vSmart × cS[i] × tProfS         // Profundización SMART
adicST = vSmart × cS[i] × tAdicS         // Didácticas SMART
usoCT  = vCore  × cC[i] × tUsoC          // Uso CORE
profCT = vCore  × cC[i] × tProfC         // Profundización CORE
adicCT = vCore  × cC[i] × tAdicC         // Didácticas CORE
coreUP = usoCT + profCT                  // uso+prof de CORE del mes

smart  = usoT + profT + adicST           // total SMART del mes
core   = adicCT + usoCT + profCT         // total CORE del mes (didác + uso + prof)
```

### Capacidad y reparto empleados vs. externos
Regla fija (sin controles): **uso + profundización de AMBAS campañas** los cubren empleados **mientras haya capacidad**; el sobrecupo entra a externos. **Las didácticas específicas son SIEMPRE externas.**
```
cap     = nAse × tDay × dWeek × wMonth      // capacidad de empleados (servicios/mes)
up      = usoT + profT + usoCT + profCT     // TODA la demanda de uso/prof (SMART+CORE)
cov     = min(up, cap)                      // uso/prof cubierto por empleados
extUP   = max(0, up − cap)                  // sobrecupo de uso/prof → externos
adicExt = adicST + adicCT                   // didácticas: SIEMPRE externas
totExt  = extUP + adicExt                   // total externo del mes
util    = cov / cap                         // utilización de empleados
```
Invariante: `cov + extUP === up` (todo servicio de uso/prof está cubierto o es externo) y las didácticas nunca entran a `cov`. Como CORE uso/prof también compite por la capacidad (y su curva es tardía y voluminosa), la capacidad se satura y hay varios meses de sobrecupo — es el comportamiento esperado.

### Retención vs. conquista (por campaña)
```
rS = retS/100 ; rC = retC/100
retSmart  = smart × rS ; conqSmart = smart × (1−rS)
retCore   = core  × rC ; conqCore  = core  × (1−rC)
```
La retención conserva la base actual; el resto es conquista (clientes nuevos). No afecta costos.

---

## 4. Módulo de costos ⭐ (lo más nuevo y delicado)

**Insumos** (interfaz `CostInputs`, editables en el panel "Costos"):

| Insumo | Semilla | Qué es |
|---|---|---|
| `costoUso` | $0 | Costo por servicio de Uso |
| `costoProf` | $0 | Costo por servicio de Profundización |
| `costoDidac` | $3,750 | Costo por servicio de Didáctica específica |
| `costoTraslado` | $1,500 | Costo por **traslado** (evento fijo) |
| `propTrasUso` | 0% | % de servicios de Uso que requieren traslado |
| `propTrasProf` | 0% | % de Profundización que requieren traslado |
| `propTrasDidac` | 40% | % de Didácticas que requieren traslado |

**Fórmula** (por tipo de servicio *s* ∈ {uso, prof, didác}):
```
Nₛ              = cantidad anual de servicios de ese tipo
Costo_servicio_s = Nₛ × costoUnitario_s
Traslados_s      = Nₛ × (propTraslado_s / 100)
Costo_traslado_s = Traslados_s × costoTraslado

COSTO DE SERVICIOS = Σ Costo_servicio_s
COSTO DE TRASLADOS = Σ Costo_traslado_s
COSTO TOTAL        = servicios + traslados
```
Donde `N_uso = Σ(usoT+usoCT)`, `N_prof = Σ(profT+profCT)`, `N_didac = Σ(adicST+adicCT)`. Es decir, **las cubetas de costo son por tipo, no por campaña**: CORE uso/prof caen en las mismas cubetas `uso`/`prof` que SMART. Con las semillas ($0 uso/prof, 0% traslado uso/prof) no cambian el costo total ($5,950,800); ponles costo para que sí cuenten.

**Dónde vive el resultado:**
- Por mes: `MonthRow.costServ`, `.costTras`, `.costTot` (para la gráfica mensual).
- Anual: `k.costs = { byType[], servicios, traslados, trasladosN, total }` (para KPIs y la tabla de desglose).

**Ejemplo con las semillas**: didácticas = 1368 servicios (321 SMART + 1047 CORE) → servicios $5,130,000 + traslados (1368 × 40% × $1,500 = $820,800) = **$5,950,800**.

**Notas de comportamiento:**
- Un **traslado** es un evento de costo fijo; su cantidad sale de la proporción, **no** se redondea internamente (se muestra redondeado). Si algún día se quieren viajes enteros, redondear con `Math.ceil`.
- Como uso/prof cuestan $0 por defecto, la **intensidad** (que solo mueve `tUsoS`/`tProfS` de SMART) no cambia el costo total hasta que les pongas costo. Las didácticas (`tAdicS`/`tAdicC` fijos) mandan el costo.
- Las **proporciones no alteran** el costo de servicios, solo el de traslados (hay una prueba que lo fija).

---

## 5. Cómo cambiar cosas SIN romper

| Quiero… | Toca… | Cuidado con… |
|---|---|---|
| Cambiar el volumen de una campaña | `DEFAULTS.vSmart`/`vCore` o el panel "Volúmenes" | Escala todos los tipos de esa campaña a la vez. |
| Cambiar servicios/colegio de un tipo | `DEFAULTS.tUsoS/tProfS/tAdicS` (SMART) o `tUsoC/tProfC/tAdicC` (CORE), o la rejilla 2×3 | La intensidad sobreescribe `tUsoS/tProfS`. |
| Cambiar una semilla de costo | `DEFAULTS` (bloque de costos) en `model.ts` | Hay una prueba que fija las semillas — actualízala. |
| Agregar un tipo de costo nuevo | `CostInputs` + `compute` (loop y `byType`) + `Defaults`/`DEFAULTS` + UI en `Simulador.tsx` | Agrega también su prueba en `model.test.ts`. |
| Cambiar la regla de capacidad | `cap = …` y `cov/extUP` en `compute` | Uso/prof (ambas campañas) van a empleados primero; didácticas siempre externas. Las pruebas de capacidad deben seguir pasando. |
| Cambiar la curva de cierre de una campaña | curvas `smart`/`core` en `DEF_CURVES`, o los sliders "SMART"/"CORE" | Aplica a los 3 tipos de esa campaña. El streamgraph usa otras curvas (`uso/prof/adicS/adicC`, `Cu/Cp`), no se sincronizan. |
| Ajustar la intensidad | `applyIntensity` en `Simulador.tsx` | Solo mueve `tUsoS/tProfS/tAdicS` (SMART); no toca CORE, volúmenes ni costos. |
| Agregar una columna al CSV | `exportCSV` en `Simulador.tsx` | Manténlo alineado con el `head`. |

## 6. Invariantes (NO romper)
- `compute` devuelve **12 filas** (una por mes) y **sin NaN** aunque `cap=0` o volúmenes en 0 (hay pruebas).
- `k.costs.total === Σ costTot mensual === servicios + traslados` (probado).
- El volumen de CORE·didácticas en `SERVICE_PROFILES` (perfil `Cd`) es **1745** (prueba de regresión del bug 1500/1745 del streamgraph).
- El estado del simulador (`n`, `curves`) **no** se persiste (solo escenarios A/B en `localStorage`); recargar restablece los defaults.
