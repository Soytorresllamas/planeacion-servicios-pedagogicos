// Sesión de usuario (V3) + visibilidad por rol.
// La sesión vive en sessionStorage: se pierde al cerrar la pestaña, como debe.
import type { Rol } from '../data/usuarios';

export interface Sesion {
  usuarioId: string;
  rol: Rol;
  nombre: string;      // para el saludo/encabezado
  asesorId?: string;   // rol asesor: su hoja
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

/** Pestañas del menú según el rol. El asesor no tiene menú: vive en su portal. */
export const tabsPorRol = (rol: Rol): { to: string; label: string }[] => {
  switch (rol) {
    case 'admin':
      return [
        { to: '/simulador', label: 'Simulador' },
        { to: '/planeacion', label: 'Planeación' },
        { to: '/rentabilidad', label: 'Rentabilidad' },
        { to: '/administracion', label: 'Administración' },
      ];
    case 'coordinador':
    case 'logistica':
      return [
        { to: '/planeacion', label: 'Planeación' },
        { to: '/rentabilidad', label: 'Rentabilidad' },
      ];
    case 'asesor':
      return [];
  }
};

/** A dónde aterriza cada rol al entrar. */
export const rutaInicial = (rol: Rol): string =>
  rol === 'asesor' ? '/mi-hoja' : rol === 'logistica' ? '/rentabilidad' : '/planeacion';

/** ¿El rol puede ver esta ruta? (mi-hoja es del asesor; los demás la ven como vista previa) */
export const rutaPermitida = (rol: Rol, path: string): boolean => {
  if (rol === 'admin') return true;
  if (rol === 'asesor') return path === '/mi-hoja';
  // coordinador y logística: sus pestañas + la vista previa del portal
  return ['/planeacion', '/rentabilidad', '/mi-hoja'].includes(path);
};
