// Usuarios, roles y catálogos (V3 · blindada).
// La IDENTIDAD (correos/contraseñas) vive en Supabase Auth; los perfiles y
// roles en la tabla psp_usuarios (RLS por rol). Aquí solo quedan tipos y
// helpers PUROS testeables; las operaciones viven en lib/usuariosStore.ts.

export type Rol = 'admin' | 'coordinador' | 'logistica' | 'asesor' | 'ejecutivo';

export const ROLES: { key: Rol; label: string; descripcion: string }[] = [
  { key: 'admin', label: 'Administrador', descripcion: 'Acceso a todo, incluida Administración' },
  { key: 'coordinador', label: 'Coordinador', descripcion: 'Planeación y Rentabilidad' },
  { key: 'logistica', label: 'Responsable Logística', descripcion: 'Planeación y Rentabilidad (captura costos)' },
  { key: 'asesor', label: 'Asesor', descripcion: 'Solo su hoja de colegios asignados' },
  { key: 'ejecutivo', label: 'Ejecutivo Comercial', descripcion: 'Solo el estatus de SUS colegios (lectura)' },
];

/** Perfil de usuario (espejo de la tabla psp_usuarios; el id es el uid de Auth). */
export interface Usuario {
  id: string;              // uuid de auth.users
  correo: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  asesorId?: string;       // rol asesor: liga con Asesor de planeación
  ejecutivo?: string;      // rol ejecutivo: su nombre como viene en «Ejecutivo Responsable» del BI
  fechaIngreso?: string;   // ISO 'YYYY-MM-DD' (ingreso a SM)
  tempPassword: boolean;   // true → debe cambiarla al entrar
  activo: boolean;
  creado: string;          // ISO datetime
  ultimoIngreso?: string;  // ISO datetime
  ingresos: number;        // total de inicios de sesión
}

/** Catálogos compartidos (fila 'catalogos-v3' de psp_admin). */
export interface CatalogosData {
  gerencias: string[];
  ejecutivos: string[];    // ejecutivos comerciales
}

export const defaultCatalogos = (): CatalogosData => ({ gerencias: [], ejecutivos: [] });

// ── utilidades puras ──
const CORREO_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const correoValido = (c: string): boolean => CORREO_RX.test(c.trim());

/** Contraseña temporal legible (sin caracteres ambiguos O/0, I/1…). */
export function genTempPassword(rand: () => number = Math.random): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(rand() * abc.length)];
  return `SM-${s}`;
}

/** ¿`id` es el ÚNICO administrador activo? Sirve para impedir lockouts. */
export function esUnicoAdminActivo(usuarios: Usuario[], id: string): boolean {
  const admins = usuarios.filter((u) => u.rol === 'admin' && u.activo);
  return admins.length === 1 && admins[0].id === id;
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
