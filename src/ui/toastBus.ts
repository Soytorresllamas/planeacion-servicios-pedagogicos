// Bus mínimo de notificaciones: toast() se puede llamar desde cualquier módulo
// y el <Toaster/> montado en App las muestra. Separado del componente para que
// react-refresh funcione (los archivos de componentes solo exportan componentes).
export type ToastKind = 'ok' | 'err' | 'info'
type Push = (msg: string, kind: ToastKind) => void

let push: Push | null = null

/** La registra el Toaster al montarse. */
export const registrarToaster = (p: Push | null): void => { push = p }

/** Lanza una notificación desde cualquier parte de la app. */
export const toast = (msg: string, kind: ToastKind = 'info'): void => { push?.(msg, kind) }
