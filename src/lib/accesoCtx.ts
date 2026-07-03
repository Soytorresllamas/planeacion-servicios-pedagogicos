// Contexto de acceso: sesión + tablero de administración compartidos.
// Separado del componente <Acceso> para que react-refresh funcione.
import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AdminData } from '../data/usuarios';
import type { Sesion } from './sesion';

export interface AccesoCtx {
  sesion: Sesion;
  admin: AdminData;
  setAdmin: Dispatch<SetStateAction<AdminData>>;
  adminStatus: string;   // Sincronizado / Sin conexión · local / Guardando…
  salir: () => void;
}

export const AccesoContexto = createContext<AccesoCtx | null>(null);

export const useAcceso = (): AccesoCtx => {
  const c = useContext(AccesoContexto);
  if (!c) throw new Error('useAcceso debe usarse dentro de <Acceso>');
  return c;
};
