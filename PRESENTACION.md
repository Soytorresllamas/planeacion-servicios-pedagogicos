# SM · Planeación 2 Campañas — Cómo funciona la plataforma

*Documento divulgativo para compartir con el equipo y armar la presentación.
Versión: julio 2026 · Nuevo modelo 2026-2027 · Comité de Negocios SM México.*

---

## 1 · Qué es, en una frase

Una plataforma web que acompaña **todo el ciclo del nuevo modelo de servicios
académicos**: desde simular la capacidad y los costos, pasando por planear y
ejecutar los servicios colegio por colegio, hasta medir la **rentabilidad real**
de cada colegio, gerencia y campaña.

**Liga:** https://soytorresllamas.github.io/sm-campanas-app/ (protegida con contraseña).

---

## 2 · El problema que resuelve

El modelo 2026-2027 opera **dos campañas** (SMART y CORE) con un compromiso de
servicios pedagógicos por colegio. Eso plantea preguntas que antes se respondían
en hojas sueltas:

- ¿**Alcanza la capacidad** de los asesores empleados o necesitamos externos?
- ¿**Quién atiende qué colegio**, cuándo, y cómo va el avance real?
- ¿Qué **costo** real tiene servir a cada colegio y **vale la pena** contra su valor?

La plataforma junta esas tres conversaciones en un solo lugar, con los mismos
datos para todos.

---

## 3 · El corazón del modelo

- **Dos campañas:** SMART (413 colegios) y CORE (2,069) — 2,482 colegios en total.
- **Cuatro categorías de colegio** por campaña, con su mezcla y su paquete de
  servicios anuales:

| Categoría | % SMART | % CORE | Uso | Profundización | Didáctica Específica |
|---|---|---|---|---|---|
| **Top** | 23 % | 17 % | 3 | 2 | 1 |
| **Alto** | 38 % | 23 % | 2 | 2 | 1 |
| **Medio** | 32 % | 43 % | 1 | 1 | 1 |
| **Bajo** | 7 % | 17 % | 1 | 1 | 0 |

- **Regla de ejecución:** Uso y Profundización los dan **asesores empleados**
  mientras haya capacidad (≈ 520 servicios al año por asesor; 10 asesores);
  lo que desborda lo cubren **externos**. Las **Didácticas Específicas siempre
  las ejecutan externos** (el asesor coordina y da seguimiento).
- **Costos de referencia:** didáctica $3,750 · traslado $1,500 (el Simulador
  estima; Rentabilidad captura lo real).

---

## 4 · Los cinco módulos

### 🎛️ Simulador — *para el comité*
Responde "¿qué pasa si…?": mueve volúmenes, mezcla de categorías, capacidad de
asesores y costos, y ve al instante coberturas por mes (con las 3 intensidades
por tipo de servicio), el reparto empleados vs externos y el costo estimado del
ciclo. Es la **estimación ex-ante** del modelo.

### 📋 Planeación — *para la coordinación*
Convierte el modelo en operación:
- **Cupos** de colegios generados desde el Simulador (o el catálogo real de BI).
- **Asignación** de colegios a cada asesor, con alerta de sobrecarga.
- **Hoja del asesor** (vista del coordinador): tarjetas por colegio con sus
  servicios, fechas plan/real, estatus, notas, serie/inglés y satisfacción; vista
  agenda por mes; filtros por todo.
- **Alertas de casos críticos** levantadas por los asesores, para atenderlas.
- **Carga masiva**: importa el catálogo real de colegios (Excel/CSV de BI).

### 📱 Portal del asesor — *para el asesor en campo (móvil)*
Cada asesor entra con su acceso y ve **solo su cartera**: agenda próxima,
vencidos, avance, tarjetas compactas de sus colegios (marcar realizado con un
clic, fechas, notas, satisfacción con caritas) y un botón flotante para
**reportar un caso crítico** (materiales, atención, facturación) que llega
directo al coordinador.

### 💰 Rentabilidad — *para dirección y la Responsable Logística*
La **medición ex-post**:
- **Análisis:** valor de la cartera vs costo real capturado → margen y % de
  rentabilidad, agregado por gerencia, asesor, ejecutivo comercial, campaña o
  categoría, y el detalle por colegio.
- **Hoja logística:** la Responsable Logística ve todos los servicios y captura
  por fila si hubo **traslado** (y su costo) y el **costo del externo**, con
  filtros por asesor, colegio y gerencia.

---

## 5 · Quién ve qué (roles)

| Rol | Entra a | Ve / hace |
|---|---|---|
| **Comité / dirección** | Toda la app | Simula, revisa avance y rentabilidad |
| **Coordinación** | Planeación | Asigna colegios, da seguimiento, atiende alertas, importa el catálogo |
| **Asesor pedagógico** | Portal `#/mi-hoja` | Solo su cartera; ejecuta y reporta |
| **Responsable Logística** | Rentabilidad → Hoja logística | Captura traslados y costos de externos |
| **Ejecutivo comercial** | — (por ahora) | Aparece como dato del colegio para el análisis |

---

## 6 · El flujo del dato (de BI a la decisión)

```
 Inteligencia de Negocio          Coordinación               Asesor              Resp. Logística         Dirección
 ───────────────────────          ─────────────              ──────              ───────────────         ─────────
 Llena la plantilla Excel   →   Importa el catálogo    →   Ejecuta y marca   →   Captura traslados   →   Lee margen y
 (colegio, campaña,             (2 clics; los asesores      sus servicios        y costos de             rentabilidad por
 categoría, valor real,          pedagógicos reciben        en su portal         externos                gerencia/asesor/
 gerencia, ejecutivo,            sus colegios en                                                         campaña/colegio
 asesor pedagógico…)             automático)
```

- La **plantilla oficial** (descargable desde la app) distingue dos figuras:
  el **Ejecutivo Responsable** (comercial: queda como dato de análisis) y el
  **Asesor Pedagógico** (quien atiende: se vuelve asesor y recibe el colegio).
- Mientras BI entrega el catálogo, la app funciona con **cupos simulados** del
  Simulador — todo el flujo ya es operable hoy.

---

## 7 · Cómo está construida (en corto)

- **Web moderna** (React + TypeScript), sin instalación: corre en navegador y
  en el celular. Publicada en GitHub Pages con despliegue automático.
- **Datos compartidos y sincronizados** (Supabase): lo que captura logística lo
  ve el coordinador al momento. Si no hay conexión, la app sigue funcionando en
  local y avisa.
- **Calidad:** 79 pruebas automáticas de la lógica de negocio corren antes de
  cada publicación (si algo se rompe, no se publica). Respaldo permanente en
  GitHub con historial completo.
- **Acceso:** contraseña de equipo para la app del comité; el portal del asesor
  tiene su propio inicio de sesión (hoy simulado, listo para autenticación real).

---

## 8 · Estado actual y siguientes pasos

**Hoy (julio 2026):** todos los módulos en producción, operando con los 2,482
cupos simulados. Plantilla lista y enviada a BI.

**Siguientes pasos:**
1. **Carga del catálogo real** de BI (activa el análisis de rentabilidad completo).
2. **Autenticación real por asesor** en el portal (hoy es una simulación).
3. **Portal propio para la Responsable Logística**, si se decide separar su acceso.
4. **Comparativo estimado vs real** (Simulador vs Rentabilidad) por mes.
5. Afinar catálogos (series, inglés, problemas) con los datos reales.

---

## 9 · Guión sugerido para la presentación (10 láminas)

1. **Portada** — "Una plataforma para el ciclo completo del nuevo modelo".
2. **El reto** — 2 campañas, 2,482 colegios, capacidad limitada, costos por medir (§2).
3. **El modelo** — la tabla de categorías y la regla internos/externos (§3).
4. **Demo 1: Simulador** — mover una palanca en vivo y ver el efecto.
5. **Demo 2: Planeación** — asignar un colegio y ver la hoja del asesor.
6. **Demo 3: Portal del asesor** — en el celular: marcar un servicio y reportar un caso.
7. **Demo 4: Rentabilidad** — capturar un costo y ver el margen moverse.
8. **El flujo del dato** — el diagrama de §6 (BI → decisión).
9. **Confiabilidad** — sincronizado, probado, respaldado (§7).
10. **Siguientes pasos y pedido** — catálogo de BI + acuerdos de acceso (§8).

---

*Documentación técnica por módulo en [`docs/`](docs/) · Código y historial en
GitHub: `Soytorresllamas/sm-campanas-app`.*
