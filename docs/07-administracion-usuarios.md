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

## Respaldos diarios (Administración → Respaldos)

- **Qué:** una copia diaria de cada tablero (`psp_planeacion` y `psp_admin`) en la
  tabla `psp_respaldos`. Un snapshot por día por tabla.
- **Cuándo:** automáticamente en el **primer acceso del día** (captura el estado con
  que empieza la jornada = cierre del día anterior). Deduplicado por navegador con
  una marca en `localStorage`, así que a lo más se escribe un snapshot por día.
- **Retención:** se conservan los últimos **30 días** (`RETENCION_DIAS`); los más
  viejos se podan al crear el del día.
- **Restaurar:** solo admin, desde la pestaña Respaldos. Reemplaza los datos actuales
  de esa sección con los de la fecha elegida (con confirmación). Restaurar «Usuarios»
  exige que el snapshot tenga un administrador activo, para no provocar un lockout.
- **Manual:** botón «Respaldar ahora» crea/actualiza el snapshot del día al instante
  (útil antes de una operación riesgosa como una carga masiva).
- **Requisito:** la tabla `psp_respaldos` debe existir (está en `supabase_setup.sql`).
  Sin ella, la app funciona igual y solo omite los respaldos (avisa con un toast al
  intentar «Respaldar ahora»).
- **Off-site:** para proteger contra la pérdida del proyecto Supabase completo, activar
  además los **backups automáticos de Supabase** (plan Pro) — pendiente/independiente.
- Código: `src/lib/respaldos.ts` (helpers puros + operaciones), disparo en
  `planeacionStore`/`adminStore`, UI en `pages/Administracion.tsx`.
