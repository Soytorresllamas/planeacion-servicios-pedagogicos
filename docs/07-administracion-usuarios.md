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

El primer administrador se crea en el dashboard de Supabase (ver supabase_blindaje.sql).

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

## Seguridad (V3 blindada, jul 2026)

- **Identidad:** Supabase **Auth** (correo+contraseña, bcrypt, tokens con
  refresco). Las contraseñas ya NO existen en el plano de datos de la app.
- **Autorización:** **RLS** en todas las tablas (`supabase_blindaje.sql`):
  - `psp_planeacion`: solo usuarios **activos** autenticados (los 4 roles la operan).
  - `psp_admin` (catálogos): leen los activos; escribe solo un admin.
  - `psp_usuarios`: cada quien su fila; el admin todas. Un **trigger** impide que
    alguien se cambie a sí mismo rol/activo/asesor_id/correo.
  - `psp_respaldos`: solo administradores.
  - La publishable key sola (sin sesión) **no puede leer ni escribir nada**.
- **Cuentas:** el admin da de alta (signUp con cliente secundario + fila de
  perfil). Una cuenta autenticada SIN fila de perfil (p. ej. un self-signup
  ajeno) no pasa del login: la app la expulsa y la RLS le niega los datos.
- **Reset de contraseña:** correo de recuperación de Supabase (el enlace
  regresa a la app y cae en la pantalla de contraseña nueva).
- **Manejo local:** espejos locales versionados y etiquetados por backend; al
  **salir se limpian** (nada queda en equipos compartidos); sesión JWT con
  storageKey `psp-auth-v3` gestionada por supabase-js.
- **Bootstrap:** primer admin creado en el dashboard (Authentication → Users) y
  ligado por el paso BOOTSTRAP de `supabase_blindaje.sql`.
- Pendiente futuro: separar el blob de planeación en filas por entidad para RLS
  más granular (p. ej. que el asesor solo escriba sus servicios).

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
