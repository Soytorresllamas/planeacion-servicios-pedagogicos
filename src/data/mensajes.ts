import type { NivelKey, RamaServicio } from './planeacion'

export type MensajeRol = 'ejecutivo' | 'asesor'

export interface Mensaje {
  id: string
  colegioId: string
  autorId: string
  autorNombre: string
  autorRol: MensajeRol
  rama: RamaServicio
  servicioTipo?: 'uso' | 'prof' | 'didac'
  servicioNivel?: NivelKey
  texto: string
  createdAt: string
}

export interface MensajeVista {
  colegioId: string
  ultimoVistoAt: string
}

export const mensajesOrdenados = (mensajes: Mensaje[]): Mensaje[] =>
  [...mensajes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

export const mensajesNoLeidos = (mensajes: Mensaje[], ultimoVistoAt?: string): number =>
  mensajes.filter((m) => !ultimoVistoAt || m.createdAt > ultimoVistoAt).length
