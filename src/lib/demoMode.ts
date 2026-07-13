const DEMO_PREFIX = '#/demo'

/** Las vistas públicas de demostración usan datos aislados y nunca sincronizan. */
export const isDemoMode = (): boolean =>
  typeof window !== 'undefined' && window.location.hash.startsWith(DEMO_PREFIX)

