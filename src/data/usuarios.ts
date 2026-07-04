// Usuarios, roles y catálogos de administración (V3).
// Lógica pura y testeable. La autenticación es del lado del cliente (hash
// SHA-256 en el tablero compartido) COMO MAQUETA hasta conectar el Supabase
// nuevo (Auth + RLS); el flujo de la app ya es el definitivo.

export type Rol = 'admin' | 'coordinador' | 'logistica' | 'asesor';

export const ROLES: { key: Rol; label: string; descripcion: string }[] = [
  { key: 'admin', label: 'Administrador', descripcion: 'Acceso a todo, incluida Administración' },
  { key: 'coordinador', label: 'Coordinador', descripcion: 'Planeación y Rentabilidad' },
  { key: 'logistica', label: 'Responsable Logística', descripcion: 'Planeación y Rentabilidad (captura costos)' },
  { key: 'asesor', label: 'Asesor', descripcion: 'Solo su hoja de colegios asignados' },
];

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  fechaIngreso: string;    // ISO 'YYYY-MM-DD' (ingreso a SM)
  rol: Rol;
  asesorId?: string;       // rol asesor: liga con Asesor de planeación
  passHash: string;        // SHA-256 hex
  tempPassword: boolean;   // true → debe cambiarla al entrar
  activo: boolean;
  creado: string;          // ISO datetime
  // mapeo de uso
  ultimoIngreso?: string;  // ISO datetime
  ingresos: number;        // total de inicios de sesión
}

export interface AdminData {
  usuarios: Usuario[];
  gerencias: string[];
  ejecutivos: string[];    // ejecutivos comerciales
}

// ── utilidades ──
export async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const CORREO_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const correoValido = (c: string): boolean => CORREO_RX.test(c.trim());

/** Contraseña temporal legible (sin caracteres ambiguos O/0, I/1…). */
export function genTempPassword(rand: () => number = Math.random): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(rand() * abc.length)];
  return `SM-${s}`;
}

const slugId = (correo: string): string =>
  'usr-' + correo.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** id derivado del correo, garantizando que no choque con otro ya existente
 *  (dos correos distintos pueden normalizar al mismo slug: a.b@x vs a-b@x). */
const idUnico = (correo: string, usuarios: Usuario[]): string => {
  const base = slugId(correo);
  if (!usuarios.some((u) => u.id === base)) return base;
  let n = 2, id = `${base}-${n}`;
  while (usuarios.some((u) => u.id === id)) { n++; id = `${base}-${n}`; }
  return id;
};

/** ¿`id` es el ÚNICO administrador activo? Sirve para impedir lockouts. */
export function esUnicoAdminActivo(usuarios: Usuario[], id: string): boolean {
  const admins = usuarios.filter((u) => u.rol === 'admin' && u.activo);
  return admins.length === 1 && admins[0].id === id;
}

// ── usuarios ──
export interface NuevoUsuario {
  nombre: string; apellido: string; correo: string; fechaIngreso: string;
  rol: Rol; asesorId?: string;
}

export type CrearResultado =
  | { ok: true; data: AdminData; usuario: Usuario; tempPassword: string }
  | { ok: false; error: string };

/** Crea un usuario con contraseña temporal (se muestra UNA vez al admin). */
export async function crearUsuario(data: AdminData, n: NuevoUsuario, rand?: () => number): Promise<CrearResultado> {
  const correo = n.correo.trim().toLowerCase();
  if (!n.nombre.trim() || !n.apellido.trim()) return { ok: false, error: 'Nombre y apellido son obligatorios.' };
  if (!correoValido(correo)) return { ok: false, error: 'El correo no es válido.' };
  if (data.usuarios.some((u) => u.correo === correo)) return { ok: false, error: 'Ya existe un usuario con ese correo.' };
  const tempPassword = genTempPassword(rand);
  const usuario: Usuario = {
    id: idUnico(correo, data.usuarios),
    nombre: n.nombre.trim(), apellido: n.apellido.trim(), correo,
    fechaIngreso: n.fechaIngreso, rol: n.rol, asesorId: n.asesorId,
    passHash: await sha256(tempPassword), tempPassword: true,
    activo: true, creado: new Date().toISOString(), ingresos: 0,
  };
  return { ok: true, data: { ...data, usuarios: [...data.usuarios, usuario] }, usuario, tempPassword };
}

/** Valida correo+contraseña; null si no coincide o el usuario está inactivo. */
export async function autenticar(data: AdminData, correo: string, pass: string): Promise<Usuario | null> {
  const u = data.usuarios.find((x) => x.correo === correo.trim().toLowerCase());
  if (!u || !u.activo) return null;
  return (await sha256(pass)) === u.passHash ? u : null;
}

/** Cambia la contraseña (y apaga el flag temporal). */
export async function cambiarPassword(data: AdminData, usuarioId: string, nueva: string): Promise<AdminData> {
  const hash = await sha256(nueva);
  return {
    ...data,
    usuarios: data.usuarios.map((u) => u.id === usuarioId ? { ...u, passHash: hash, tempPassword: false } : u),
  };
}

/** Genera una nueva contraseña temporal (reset del admin). */
export async function resetPassword(data: AdminData, usuarioId: string, rand?: () => number):
  Promise<{ data: AdminData; tempPassword: string }> {
  const tempPassword = genTempPassword(rand);
  const hash = await sha256(tempPassword);
  return {
    data: {
      ...data,
      usuarios: data.usuarios.map((u) => u.id === usuarioId ? { ...u, passHash: hash, tempPassword: true } : u),
    },
    tempPassword,
  };
}

/** Registra un inicio de sesión (último ingreso + contador). */
export function registrarIngreso(data: AdminData, usuarioId: string, cuando: string = new Date().toISOString()): AdminData {
  return {
    ...data,
    usuarios: data.usuarios.map((u) => u.id === usuarioId ? { ...u, ultimoIngreso: cuando, ingresos: u.ingresos + 1 } : u),
  };
}

export function patchUsuario(data: AdminData, id: string, patch: Partial<Usuario>): AdminData {
  return { ...data, usuarios: data.usuarios.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}

// ── mapeo de uso ──
export interface UsoResumen {
  total: number;
  activos: number;          // usuarios activos (no desactivados)
  nuncaEntraron: number;    // sin un solo ingreso
  activos7d: number;        // con ingreso en los últimos 7 días
  ingresosTotales: number;
}

export function usoResumen(usuarios: Usuario[], ahora: Date = new Date()): UsoResumen {
  const hace7d = ahora.getTime() - 7 * 24 * 3600 * 1000;
  let nunca = 0, act7 = 0, ing = 0;
  for (const u of usuarios) {
    ing += u.ingresos;
    if (!u.ultimoIngreso) nunca++;
    else if (new Date(u.ultimoIngreso).getTime() >= hace7d) act7++;
  }
  return {
    total: usuarios.length,
    activos: usuarios.filter((u) => u.activo).length,
    nuncaEntraron: nunca, activos7d: act7, ingresosTotales: ing,
  };
}

// ── catálogos (gerencias, ejecutivos comerciales) ──
export function agregarCatalogo(lista: string[], valor: string): string[] {
  const v = valor.trim();
  if (!v || lista.some((x) => x.toLowerCase() === v.toLowerCase())) return lista;
  return [...lista, v].sort((a, b) => a.localeCompare(b));
}

export function quitarCatalogo(lista: string[], valor: string): string[] {
  return lista.filter((x) => x !== valor);
}

export function renombrarCatalogo(lista: string[], viejo: string, nuevo: string): string[] {
  const v = nuevo.trim();
  if (!v) return lista;
  return lista.map((x) => (x === viejo ? v : x)).sort((a, b) => a.localeCompare(b));
}

// ── semilla ──
/** Tablero inicial: un administrador con contraseña temporal «SM-2027»
 *  (hash precalculado); el flujo obliga a cambiarla en el primer ingreso. */
export function defaultAdminData(): AdminData {
  return {
    usuarios: [{
      id: 'usr-admin',
      nombre: 'Administrador', apellido: 'SM', correo: 'admin@sm.com.mx',
      fechaIngreso: '2026-01-01', rol: 'admin',
      passHash: 'c05d39c179fd4e955f7c0265354a2710f2370846b347efbe9072db283e7c64bc', // SM-2027
      tempPassword: true, activo: true, creado: '2026-07-03T00:00:00.000Z', ingresos: 0,
    }],
    gerencias: [],
    ejecutivos: [],
  };
}
