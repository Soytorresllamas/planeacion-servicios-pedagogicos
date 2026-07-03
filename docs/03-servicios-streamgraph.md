# 03 · Servicios (streamgraph)

**Archivo:** `src/pages/Streamgraph.tsx` · lee de `src/data/model.ts` (`SERVICE_PROFILES`, `DEF_CURVES`).

Es la vista "Servicios (streamgraph)": muestra el **flujo de servicios por mes** de los 6 perfiles, más un "ledger" con el volumen real de colegios por perfil.

> ℹ️ **Fuera del menú (jul 2026):** la pestaña se ocultó del nav (como Documentos). La ruta sigue viva y accesible por URL: `#/servicios`. Para volver a mostrarla, agrega el `<NavLink to="/servicios">` en `src/App.tsx`.

---

## 1. Los 6 perfiles (`SERVICE_PROFILES` en `model.ts`)

| Clave | Campaña | Perfil | Volumen | Fuente de curva |
|---|---|---|---|---|
| `Su` | SMART | Uso | 458 | `src: 'uso'` (comparte con el simulador) |
| `Sp` | SMART | Profundización | 321 | `src: 'prof'` |
| `Sd` | SMART | Didácticas específ. | 160 | `src: 'adicS'` |
| `Cd` | CORE | Didácticas específ. | 1745 | `src: 'adicC'` |
| `Cu` | CORE | Uso | 1047 | `curve` propia (14 meses) |
| `Cp` | CORE | Profundización | 733 | `curve` propia (14 meses) |

- Los 4 primeros leen su curva mensual de `DEF_CURVES` (`uso`/`prof`/`adicS`/`adicC`). ⚠️ **Estas curvas ya NO se comparten con el Simulador**: desde la simplificación de jul 2026 el Simulador usa **2 curvas por campaña** (`smart`/`core`), mientras el streamgraph conserva las curvas por tipo. Son vistas con modelos distintos a propósito.
- Los 2 de CORE (uso/prof) son **adopción aguas abajo del verano 2027** y traen `curve` propia de 14 meses.
- Los **volúmenes** salen de `SERVICE_PROFILES` (6 perfiles: 458/321/160/1745/1047/733), independientes de los 2 volúmenes por campaña del Simulador (`vSmart`/`vCore`).

## 2. Eje de 14 meses y alineación
El eje va de Sep'26 a Oct'27 (14 meses). Los meses del modelo (`DEF_CURVES`, Oct'26→Sep'27) se alinean a los **índices 1..12**; Sep'26 (0) y Oct'27 (13) quedan fuera de la ventana operativa. `bandFor(p)` arma la banda: si el perfil tiene `src`, mapea la curva del modelo a esos índices; si tiene `curve`, la usa directo. Todo normalizado al volumen real del perfil.

## 3. Colores
SMART = familia **azul** (variantes por tipo), CORE = familia **teal/verde** (variantes). Definidos en `fill` de cada perfil en `SERVICE_PROFILES`. **Nunca rojo.**

## 4. Cómo cambiar cosas SIN romper
| Quiero… | Toca… | Cuidado con… |
|---|---|---|
| Cambiar un volumen | `SERVICE_PROFILES.vol` en `model.ts` | También alimenta el simulador (los que tienen `src`). |
| Cambiar la forma temporal de un perfil SMART | su curva en `DEF_CURVES` | cambia también en el simulador (es la misma). |
| Cambiar la forma de CORE uso/prof | el arreglo `curve` del perfil | es exclusivo del streamgraph. |
| Cambiar un color | `fill` del perfil | mantén azul=SMART / teal=CORE. |

## 5. Invariantes
- **Volumen y nombre "servicios"** (no "talleres") en toda la vista.
- El chart de área usa `isAnimationActive={false}` **a propósito**: sin eso, la animación no completaba en render inicial/headless y el gráfico se publicaba en blanco. No lo quites.
