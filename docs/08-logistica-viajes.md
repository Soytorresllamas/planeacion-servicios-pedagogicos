# 08 · Logística de viajes y hospedaje

Módulo V3.2. Cierra el ciclo operativo de un servicio agendado: **marcar necesidad →
reservar → viajar**. Página: `src/pages/Logistica.tsx` (ruta `/logistica`).

## Flujo (quién hace qué)

1. **Responsable logística** (o coordinación/admin), en **Planeación → Hoja del asesor →
   Agenda**, marca por servicio agendado dos checks independientes: **✈️ Viaje**
   (transporte: avión o camión) y **🏨 Hospedaje**.
   - Marcar **viaje** pre-marca `traslado` en la captura de costos de Rentabilidad
     (un dato, dos usos; después solo se captura el monto). Desmarcar viaje NO quita
     `traslado`: el costo real puede existir aunque la reserva cambie.
2. Todo servicio con necesidad aparece en la sección **Logística**: tabla consolidada
   (fecha · colegio · asesor · servicio · gerencia · necesidad · estado) con KPIs
   (pendientes, viajan en 7 días, completas) y filtros (colegio, asesor, gerencia,
   estado de reserva, incluir realizados).
3. **Responsable de Viajes** (rol `viajes`, 6º) carga ahí los **PDFs de reservas**,
   por separado: transporte y hotel. Puede reemplazarlos (sube el nuevo y borra el
   anterior) o quitarlos. Solo viajes/admin cargan; coordinación/logística consultan.
4. **El asesor** ve en su portal (tarjeta del colegio, fila del servicio) los botones
   **🎫 Transporte** y **🏨 Hotel** que abren sus PDFs; mientras no haya PDF ve el
   badge «en trámite».

## Dónde viven los datos

- **Campos por servicio** (`src/data/planeacion.ts` → `Servicio`): `reqViaje`,
  `reqHospedaje` (necesidad) y `pdfTransporte`, `pdfHotel` (**paths** en Storage,
  nunca los bytes). Viajan dentro del blob de planeación como todo lo demás.
- **Los PDFs viven en Supabase Storage**, bucket privado **`psp-reservas`**
  (máx 10 MB, solo `application/pdf`). Capa: `src/lib/reservasStore.ts`
  (`subirReserva`, `urlReserva` con URL firmada de 1 h, `borrarReserva`).
- **RLS del bucket** (`supabase_actualizacion_v3_2.sql`): leen los usuarios activos
  (el asesor descarga con URL firmada); suben/reemplazan/borran solo `viajes`/`admin`
  (función `psp_gestiona_reservas()`).

## Lógica pura (testeada en `planeacion.test.ts`)

- `marcarNecesidadViaje(colegios, id, idx, {reqViaje?, reqHospedaje?})` — con el
  pre-marcado de `traslado`.
- `filasViajes(colegios)` — servicios con necesidad, ordenados por fecha planeada.
- `estadoReserva(s)` — `pendiente | parcial | completa` (un PDF por necesidad marcada).
- `resumenViajes(colegios, hoy)` — KPIs (ignora realizados).

## Roles y acceso

- La sección la ven: **admin, coordinador, logistica, viajes** (`lib/sesion.ts`).
- `viajes` entra directo a `/logistica` y es su única pestaña (mínimo privilegio).
- La escritura del blob por `viajes` está cubierta por la política `planeacion_rw`
  (cualquier usuario activo), igual que el resto de roles.

## Qué NO tocar / trampas

- **Nunca guardes el PDF (base64) en el blob**: inflaría `psp_planeacion` y cada
  guardado con debounce lo reescribiría completo. Solo paths.
- El **path del archivo es el único puntero**: nombre aleatorio e inadivinable
  (`{tipo}/{ts}-{16hex}.pdf`). Al reemplazar/quitar hay que borrar el archivo previo
  (lo hace la página); un huérfano ocasional en Storage es aceptable, un path roto no.
- Los campos de viaje/PDFs **no viajan a la vista del director** (sanitizados por
  `datosDirector`; hay prueba que lo garantiza).
- La verificación con datos reales (subir/ver/reemplazar) requiere haber corrido
  `supabase_actualizacion_v3_2.sql` (bucket + políticas + rol).
