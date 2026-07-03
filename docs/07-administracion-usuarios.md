# 07 · Administración, usuarios y roles (V3)

V3 sustituye el gate de contraseña compartida por **cuentas de usuario con
roles**, administradas desde la pestaña **Administración**.

## Roles y visibilidad

| Rol | Ve | Aterriza en |
|---|---|---|
| **Administrador** | Todo: Simulador, Planeación, Rentabilidad, Administración (+rutas ocultas) | Planeación |
| **Coordinador** | Planeación y Rentabilidad | Planeación |
| **Responsable Logística** | Planeación y Rentabilidad | Rentabilidad |
| **Asesor** | SOLO su hoja (`#/mi-hoja`, ligada a su `asesorId`) | Su portal |

- Los roles se asignan en **Administración → Usuarios** (editable en cualquier momento).
- La guarda vive en `lib/sesion.ts` (`tabsPorRol`, `rutaPermitida`, `rutaInicial`)
  y se aplica en `App.tsx`; una ruta no permitida redirige al inicio del rol.
- Los roles no-asesor pueden abrir `#/mi-hoja` como **vista previa** (selector de asesor).

## Flujo de cuentas

1. El admin crea el usuario (nombre, apellido, correo, fecha de ingreso, rol).
   - Rol asesor: se **crea su hoja de asesor** automáticamente o se liga a una existente.
2. Se genera una **contraseña temporal** (`SM-XXXXXX`, alfabeto sin ambigüedades)
   que se muestra **una sola vez** (botón copiar).
3. En su primer ingreso, la persona **debe cambiarla** (pantalla obligatoria, mínimo 8).
4. El admin puede **resetear** la contraseña (nueva temporal) o **desactivar** la
   cuenta (bloquea el acceso sin borrar historial).

Cuenta semilla: `admin@sm.com.mx` / `SM-2027` (temporal: el primer ingreso pide
cambiarla). Cambiar en cuanto se instale el tablero real.

## Mapeo de uso

`registrarIngreso` guarda último ingreso y acumula el contador en cada login.
**Administración → Uso** muestra: cuentas totales, activos de la última semana,
quienes **nunca han entrado**, ingresos acumulados, y una tabla por persona con
señal de seguimiento (Activo / N días sin entrar / Nunca ha entrado / Desactivado).

## Qué vive en Administración

- **Colegios**: carga masiva del archivo de BI (movida desde Planeación) — además
  alimenta los catálogos con las gerencias/ejecutivos del archivo — y el ajuste de
  **Valor real** por colegio (buscador + edición inline; gerencia y ejecutivo desde catálogos).
- **Catálogos**: CRUD de **Gerencias** y **Ejecutivos Comerciales**. Renombrar
  propaga a los colegios que lo referencian; quitar del catálogo no toca los colegios.
- **Usuarios**: alta con contraseña temporal, rol, hoja de asesor, activar/desactivar, reset.
- **Uso**: los indicadores de arriba.

## Seguridad (estado actual)

La autenticación es **del lado del cliente** (SHA-256 sobre el tablero compartido
`psp_admin`): suficiente como maqueta interna, **no** como seguridad real. El
siguiente paso es el Supabase nuevo (pendiente de que lo entregue el usuario):
**Supabase Auth** (los correos/contraseñas ahí) + **RLS** por rol en `psp_planeacion`
y `psp_admin`. El flujo de la app no cambia: solo se sustituye `autenticar/
cambiarPassword` por las llamadas de Auth.

**Persistencia:** `psp_planeacion` (colegios/asesores/alertas) y `psp_admin`
(usuarios/catálogos), con espejo local versionado (`psp-planeacion-v3`, `psp-admin-v3`)
y sesión en `sessionStorage` (`psp-sesion-v3`).
