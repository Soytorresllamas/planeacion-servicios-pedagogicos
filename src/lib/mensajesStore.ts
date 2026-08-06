import { supabase } from './supabase'
import type { NivelKey, RamaServicio } from '../data/planeacion'
import type { Mensaje, MensajeRol, MensajeVista } from '../data/mensajes'

export const T_MENSAJES = 'psp_mensajes'
export const T_MENSAJE_VISTAS = 'psp_mensaje_vistas'

interface MensajeRow {
  id: string
  colegio_id: string
  autor_id: string
  autor_rol: MensajeRol
  rama: RamaServicio
  servicio_tipo: 'uso' | 'prof' | 'didac' | null
  servicio_nivel: NivelKey | null
  texto: string
  created_at: string
  autor_nombre: string
}

interface VistaRow { colegio_id: string; ultimo_visto_at: string }

const mapMensaje = (r: MensajeRow): Mensaje => ({
  id: r.id, colegioId: r.colegio_id, autorId: r.autor_id, autorNombre: r.autor_nombre,
  autorRol: r.autor_rol, rama: r.rama, servicioTipo: r.servicio_tipo ?? undefined,
  servicioNivel: r.servicio_nivel ?? undefined, texto: r.texto, createdAt: r.created_at,
})

export async function cargarMensajes(): Promise<Mensaje[]> {
  const { data, error } = await supabase.from(T_MENSAJES)
    .select('id,colegio_id,autor_id,autor_rol,rama,servicio_tipo,servicio_nivel,texto,created_at,autor_nombre')
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as MensajeRow[]).map(mapMensaje)
}

export async function cargarVistas(): Promise<MensajeVista[]> {
  const { data, error } = await supabase.from(T_MENSAJE_VISTAS).select('colegio_id,ultimo_visto_at')
  if (error || !data) return []
  return (data as VistaRow[]).map((r) => ({ colegioId: r.colegio_id, ultimoVistoAt: r.ultimo_visto_at }))
}

export interface NuevoMensaje {
  colegioId: string
  autorNombre: string
  autorRol: MensajeRol
  rama: RamaServicio
  texto: string
  servicioTipo?: 'uso' | 'prof' | 'didac'
  servicioNivel?: NivelKey
}

export async function crearMensaje(n: NuevoMensaje): Promise<{ ok: boolean; mensaje?: Mensaje; error?: string }> {
  const texto = n.texto.trim()
  if (!texto) return { ok: false, error: 'Escribe un mensaje antes de enviarlo.' }
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { ok: false, error: 'La sesión expiró. Vuelve a entrar.' }
  const row: MensajeRow = {
    id: `msg-${crypto.randomUUID()}`, colegio_id: n.colegioId, autor_id: auth.user.id,
    autor_rol: n.autorRol, rama: n.rama, servicio_tipo: n.servicioTipo ?? null,
    servicio_nivel: n.servicioNivel ?? null, texto, created_at: new Date().toISOString(), autor_nombre: n.autorNombre,
  }
  const { data, error } = await supabase.from(T_MENSAJES).insert(row).select('*').single()
  if (error || !data) return { ok: false, error: error?.message ?? 'No se pudo enviar el mensaje.' }
  return { ok: true, mensaje: mapMensaje(data as MensajeRow) }
}

export async function marcarMensajesVistos(colegioId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return
  await supabase.from(T_MENSAJE_VISTAS).upsert({
    usuario_id: auth.user.id, colegio_id: colegioId, ultimo_visto_at: new Date().toISOString(),
  }, { onConflict: 'usuario_id,colegio_id' })
}
