// Sesión de usuario (V3) + visibilidad por rol.
// La sesión vive en sessionStorage: se pierde al cerrar la pestaña, como debe.
import type { Rol } from '../data/usuarios';

export interface Sesion {
  usuarioId: string;
  rol: Rol;
  nombre: string;      // para el saludo/encabezado
  asesorId?: string;   // rol asesor: su hoja
  ramaAsesor?: 'pedagogica' | 'ingles';
  ejecutivo?: string;  // rol ejecutivo: su nombre de «Ejecutivo Responsable» (casa sus colegios)
  gerencia?: string;   // rol gerente: su gerencia regional
}

const KEY = 'psp-sesion-v3';

export const leerSesion = (): Sesion | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Sesion;
    return s && s.usuarioId && s.rol ? s : null;
  } catch { return null; }
};

export const guardarSesion = (s: Sesion): void => {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
};

export const cerrarSesion = (): void => {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
};

/** Pestañas del menú según el rol. Asesor y ejecutivo no tienen menú: viven en su portal. */
export const tabsPorRol = (rol: Rol): { to: string; label: string }[] => {
  switch (rol) {
    case 'admin':
      return [
        { to: '/simulador', label: 'Simulador' },
        { to: '/planeacion', label: 'Planeación' },
        { to: '/rentabilidad', label: 'Retorno' },
        { to: '/logistica', label: 'Logística' },
        { to: '/gerencia', label: 'Gerencias' },
        { to: '/administracion', label: 'Administración' },
      ];
    case 'coordinador':
    case 'logistica':
      return [
        { to: '/planeacion', label: 'Planeación' },
        { to: '/rentabilidad', label: 'Retorno' },
        { to: '/logistica', label: 'Logística' },
        { to: '/gerencia', label: 'Gerencias' },
      ];
    case 'gerente':
      return [{ to: '/gerencia', label: 'Mi gerencia' }];
    case 'viajes':
      return [{ to: '/logistica', label: 'Logística' }];
    case 'simulador':
      return [{ to: '/simulador', label: 'Simulador' }];
    case 'asesor':
    case 'ejecutivo':
      return [];
  }
};

/** A dónde aterriza cada rol al entrar. */
export const rutaInicial = (rol: Rol): string =>
  rol === 'asesor' ? '/mi-hoja'
    : rol === 'ejecutivo' ? '/mis-colegios'
    : rol === 'gerente' ? '/gerencia'
    : rol === 'viajes' ? '/logistica'
    : rol === 'simulador' ? '/simulador'
    : rol === 'logistica' ? '/rentabilidad' : '/planeacion';

/** ¿El rol puede ver esta ruta? Los portales (mi-hoja del asesor, mis-colegios del
 *  ejecutivo) y la vista del director los ven también coordinación/logística como
 *  vista previa; asesor, ejecutivo, viajes y simulador SOLO ven lo suyo. */
export const rutaPermitida = (rol: Rol, path: string): boolean => {
  if (rol === 'admin') return true;
  if (rol === 'asesor') return path === '/mi-hoja';
  if (rol === 'ejecutivo') return path === '/mis-colegios';
  if (rol === 'gerente') return path === '/gerencia';
  if (rol === 'viajes') return path === '/logistica';
  if (rol === 'simulador') return path === '/simulador';
  // coordinador y logística: sus pestañas + vistas previas de portales y director
  return ['/planeacion', '/rentabilidad', '/logistica', '/gerencia', '/mi-hoja', '/mis-colegios', '/vista-director'].includes(path);
};
