// Contexto de acceso: la sesión (derivada de Supabase Auth + psp_usuarios).
// Separado del componente <Acceso> para que react-refresh funcione.
// Los datos (planeación, catálogos, usuarios) los carga cada página desde su
// store; la RLS del backend es quien de verdad limita qué puede tocar cada rol.
import { createContext, useContext } from 'react';
import type { Sesion } from './sesion';

export interface AccesoCtx {
  sesion: Sesion;
  salir: () => void;
}

export const AccesoContexto = createContext<AccesoCtx | null>(null);

export const useAcceso = (): AccesoCtx => {
  const c = useContext(AccesoContexto);
  if (!c) throw new Error('useAcceso debe usarse dentro de <Acceso>');
  return c;
};
