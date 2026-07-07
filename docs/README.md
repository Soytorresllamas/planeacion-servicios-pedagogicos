# Documentación técnica · SM · Planeación 2 Campañas

Referencia por módulo para **poder cambiar cosas sin romper nada**. Cada documento explica:
la **lógica** (fórmulas / flujo de datos), **qué puedes cambiar con seguridad**, y **qué NO tocar** (invariantes y trampas ya vividas).

> Para el panorama general (arquitectura, mapa de archivos, decisiones, roadmap) lee primero
> [`../PROJECT_NOTES.md`](../PROJECT_NOTES.md). Estos docs bajan al detalle de cada módulo.

## Índice

| Documento | De qué trata |
|---|---|
| [`01-modelo-y-simulador.md`](01-modelo-y-simulador.md) | El cálculo central (`model.ts`): coberturas, capacidad de asesores, retención/conquista y **costos**. Es la fuente única de verdad y la lógica más delicada. |
| [`03-servicios-streamgraph.md`](03-servicios-streamgraph.md) | La vista "Servicios" (streamgraph): perfiles de servicio, curvas y cómo se alinea con el simulador. |
| [`04-infraestructura.md`](04-infraestructura.md) | Persistencia (Supabase), gate de contraseña, y despliegue (CI/GitHub Pages), con los aprendizajes de incidentes. |
| [`05-planeacion-servicios.md`](05-planeacion-servicios.md) | Hojas de asesores: cupos, asignación, agenda, alertas, niveles, talleres extra, contacto y enlace del director. |
| [`06-rentabilidad.md`](06-rentabilidad.md) | Rentabilidad: valor real vs costos capturados, hoja logística y carga masiva de colegios (BI). |
| [`07-administracion-usuarios.md`](07-administracion-usuarios.md) | Administración y seguridad: Auth + RLS por rol, altas con contraseña temporal, respaldos diarios, vista pública del director. |
| [`08-logistica-viajes.md`](08-logistica-viajes.md) | **Logística de viajes**: checks de viaje/hospedaje por servicio agendado, sección `/logistica`, PDFs de reservas en Storage y rol «Responsable de Viajes». |

## Reglas de oro (aplican a todo el proyecto)

1. **Colores de datos:** SMART = **azul**, CORE = **teal/verde**. El **rojo** de marca vive solo en el chrome (logo, pestaña activa, botones), **nunca** en barras/áreas/dots que codifican **campaña**. Fue un pedido explícito.
   - **Excepción deliberada (jul 2026):** la gráfica «2 · Reparto empleados vs externos» del Simulador usa **rojo = interno/uso-prof** (sólido interno · translúcido sobrecupo) y **amarillo = externo/didácticas**, por pedido explícito. Ahí el color codifica interno/externo, no campaña. No lo "arregles" a azul/teal.
2. **Una sola fuente de verdad para los volúmenes:** viven en `SERVICE_PROFILES` (en `src/data/model.ts`). Nunca escribas un volumen a mano en una vista. (Ya hubo un bug por duplicarlos: 1500 vs 1745.)
3. **Antes de subir:** corre el gate → `npm run typecheck && npm run lint && npm test && npm run build`. Todo debe quedar verde; el CI lo exige.
4. **Idioma y commits:** todo en español; commits con título corto + cuerpo con el "por qué".
