// Operaciones de usuarios sobre Supabase Auth + la tabla psp_usuarios.
// La RLS garantiza: cada quien lee su propia fila; solo un admin activo lista,
// crea o modifica a los demás (y un trigger protege rol/activo/asesor_id en
// self-updates). Ver supabase_blindaje.sql y docs/07-administracion-usuarios.md.
import { createClient } from '@supabase/supabase-js';
import { supabase, URL as SB_URL, KEY as SB_KEY } from './supabase';
import { genTempPassword, correoValido } from '../data/usuarios';
import type { Usuario, Rol } from '../data/usuarios';

export const USUARIOS_TABLE = 'psp_usuarios';

// Cliente SECUNDARIO solo para signUp: así crear una cuenta no pisa la sesión
// del administrador que la está creando (el primario persiste su propia sesión).
const supabaseAltas = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ── mapeo fila DB (snake_case) ↔ Usuario (camelCase) ──
interface FilaDB {
  id: string; correo: string; nombre: string; apellido: string; rol: Rol;
  asesor_id: string | null; ejecutivo: string | null; fecha_ingreso: string | null;
  temp_password: boolean;
  activo: boolean; creado: string; ultimo_ingreso: string | null; ingresos: number;
}

const aUsuario = (f: FilaDB): Usuario => ({
  id: f.id, correo: f.correo, nombre: f.nombre, apellido: f.apellido, rol: f.rol,
  asesorId: f.asesor_id ?? undefined, ejecutivo: f.ejecutivo ?? undefined,
  fechaIngreso: f.fecha_ingreso ?? undefined,
  tempPassword: f.temp_password, activo: f.activo, creado: f.creado,
  ultimoIngreso: f.ultimo_ingreso ?? undefined, ingresos: f.ingresos,
});

const aFila = (u: Usuario): FilaDB => ({
  id: u.id, correo: u.correo, nombre: u.nombre, apellido: u.apellido, rol: u.rol,
  asesor_id: u.asesorId ?? null, ejecutivo: u.ejecutivo ?? null,
  fecha_ingreso: u.fechaIngreso ?? null,
  temp_password: u.tempPassword, activo: u.activo, creado: u.creado,
  ultimo_ingreso: u.ultimoIngreso ?? null, ingresos: u.ingresos,
});

// ── lecturas ──
/** Fila propia (perfil del usuario con sesión). null si no existe (no autorizado). */
export async function miPerfil(): Promise<Usuario | null> {
  try {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;
    const { data, error } = await supabase.from(USUARIOS_TABLE).select('*').eq('id', uid).maybeSingle();
    if (error || !data) return null;
    return aUsuario(data as FilaDB);
  } catch { return null; }
}

/** Todos los usuarios (RLS: solo lo devuelve completo a un admin). */
export async function listarUsuarios(): Promise<Usuario[]> {
  try {
    const { data, error } = await supabase.from(USUARIOS_TABLE).select('*').order('creado');
    if (error || !data) return [];
    return (data as FilaDB[]).map(aUsuario);
  } catch { return []; }
}

// ── mutaciones ──
export type CrearResultado =
  | { ok: true; usuario: Usuario; tempPassword: string }
  | { ok: false; error: string };

export interface NuevoUsuario {
  nombre: string; apellido: string; correo: string; fechaIngreso: string;
  rol: Rol; asesorId?: string; ejecutivo?: string;
}

/** Alta: crea la cuenta en Auth (contraseña temporal) + su fila de perfil. */
export async function crearUsuario(n: NuevoUsuario, rand?: () => number): Promise<CrearResultado> {
  const correo = n.correo.trim().toLowerCase();
  if (!n.nombre.trim() || !n.apellido.trim()) return { ok: false, error: 'Nombre y apellido son obligatorios.' };
  if (!correoValido(correo)) return { ok: false, error: 'El correo no es válido.' };

  const tempPassword = genTempPassword(rand);
  const { data: alta, error: errAlta } = await supabaseAltas.auth.signUp({ email: correo, password: tempPassword });
  if (errAlta || !alta.user) {
    const msg = /already|registered|exists/i.test(errAlta?.message ?? '')
      ? 'Ese correo ya tiene cuenta. Si quedó a medias, bórralo en Supabase → Authentication → Users y vuelve a intentar.'
      : `No se pudo crear la cuenta: ${errAlta?.message ?? 'error desconocido'}`;
    return { ok: false, error: msg };
  }

  const usuario: Usuario = {
    id: alta.user.id, correo, nombre: n.nombre.trim(), apellido: n.apellido.trim(),
    rol: n.rol, asesorId: n.asesorId, ejecutivo: n.ejecutivo, fechaIngreso: n.fechaIngreso,
    tempPassword: true, activo: true, creado: new Date().toISOString(), ingresos: 0,
  };
  const { error: errFila } = await supabase.from(USUARIOS_TABLE).insert(aFila(usuario));
  if (errFila) {
    return { ok: false, error: `La cuenta se creó pero el perfil no (${errFila.message}). Reintenta o borra el usuario en Supabase → Authentication.` };
  }
  return { ok: true, usuario, tempPassword };
}

/** Cambios de perfil (rol, activo, asesorId, nombre…). RLS/trigger vigilan permisos. */
export async function patchUsuario(id: string, patch: Partial<Usuario>): Promise<{ ok: boolean; error?: string }> {
  const fila: Record<string, unknown> = {};
  if (patch.rol !== undefined) fila.rol = patch.rol;
  if (patch.activo !== undefined) fila.activo = patch.activo;
  if (patch.asesorId !== undefined) fila.asesor_id = patch.asesorId ?? null;
  if (patch.ejecutivo !== undefined) fila.ejecutivo = patch.ejecutivo ?? null;
  if (patch.nombre !== undefined) fila.nombre = patch.nombre;
  if (patch.apellido !== undefined) fila.apellido = patch.apellido;
  if (patch.tempPassword !== undefined) fila.temp_password = patch.tempPassword;
  if (patch.ultimoIngreso !== undefined) fila.ultimo_ingreso = patch.ultimoIngreso;
  if (patch.ingresos !== undefined) fila.ingresos = patch.ingresos;
  const { error } = await supabase.from(USUARIOS_TABLE).update(fila).eq('id', id);
  return { ok: !error, error: error?.message };
}

/** Marca el ingreso del usuario con sesión (último ingreso + contador). */
export async function registrarIngreso(u: Usuario): Promise<void> {
  await patchUsuario(u.id, { ultimoIngreso: new Date().toISOString(), ingresos: u.ingresos + 1 });
}

/** Tras el cambio obligatorio de contraseña: apaga el flag temporal. */
export async function marcarPasswordCambiada(id: string): Promise<void> {
  await patchUsuario(id, { tempPassword: false });
}

/** Reset de contraseña: correo de recuperación de Supabase (el enlace regresa a la app). */
export async function enviarRecuperacion(correo: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase(), { redirectTo });
    return { ok: !error, error: error?.message };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/** Restaura filas de perfil desde un respaldo (upsert; solo admin por RLS).
 *  Las contraseñas NO se tocan: viven en Auth y no forman parte del respaldo. */
export async function restaurarUsuarios(usuarios: Usuario[]): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from(USUARIOS_TABLE).upsert(usuarios.map(aFila), { onConflict: 'id' });
  return { ok: !error, error: error?.message };
}
