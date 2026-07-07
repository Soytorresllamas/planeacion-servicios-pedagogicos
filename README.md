# SM · Planeación de Servicios Pedagógicos (V3)

> 🧭 **¿Retomando el proyecto?** Empieza por [`CONTEXTO.md`](CONTEXTO.md) — resumen de arquitectura, seguridad, estado y pendientes.

Plataforma del ciclo completo de servicios pedagógicos SM 2026-2027 (campañas SMART y CORE), con cuentas de usuario por rol. Incluye:

- **Simulador** de coberturas y asesores: servicios por mes, empleados vs externos, retención vs conquista y **módulo de costos** (servicios + traslados).
- **Servicios (streamgraph)** de perfiles de servicio (uso, profundización, didácticas específicas) para SMART y CORE.
- **Planeación**: cupos, asignación a asesores, hojas de seguimiento y alertas.
- **Portal del asesor** (móvil): su cartera, agenda y casos críticos.
- **Rentabilidad**: valor real vs costos capturados por la Responsable Logística.
- **Administración**: carga masiva de colegios, valor del colegio, catálogos de gerencias y ejecutivos, usuarios (4 roles con contraseña temporal) y mapeo de uso.

## Ver en línea (GitHub Pages)


Acceso protegido con contraseña (gate ligero del lado del cliente).

## Documentación

- [`PRESENTACION.md`](PRESENTACION.md) — **cómo funciona la plataforma completa** (divulgativo, base para presentaciones).
- [`PROJECT_NOTES.md`](PROJECT_NOTES.md) — panorama general, decisiones y roadmap.
- [`docs/`](docs/README.md) — **documentación técnica por módulo**: la lógica/fórmulas de cada uno y qué se puede cambiar sin romper nada.

## Stack

Vite + React + **TypeScript** · Recharts · react-router-dom (`HashRouter`) · react-markdown · Supabase.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest
npm run build      # build de producción en dist/
npm run preview    # previsualizar el build
```

Antes de subir: `npm run typecheck && npm run lint && npm test && npm run build` — todo verde es lo que exige el CI.

## Despliegue

GitHub Actions (`.github/workflows/deploy.yml`) corre el gate (lint + typecheck + test), construye y publica a GitHub Pages en cada push a `main`. Detalles y trampas conocidas en [`docs/04-infraestructura.md`](docs/04-infraestructura.md).
