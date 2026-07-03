// Módulo de planeación de servicios pedagógicos (hojas de asesores).
// Capa operativa bajo el Simulador: ver docs/05-planeacion-servicios.md.
// Este archivo es lógica pura (sin React ni Supabase) para poder testearla.
import { DEFAULTS } from './model';
import type { Tier, TierKey, Campaign } from './model';

export type Estatus = 'pendiente' | 'agendado' | 'realizado';
export type ServTipo = 'uso' | 'prof' | 'didac';

export const ESTATUS: Estatus[] = ['pendiente', 'agendado', 'realizado'];
export const SERV_LABEL: Record<ServTipo, string> = { uso: 'Uso', prof: 'Profundización', didac: 'Didáctica' };

// Catálogos de colegio (placeholder — completar con el catálogo real de SM).
export const SERIES = ['Acierta', 'Revuela Up'];
export const INGLES = ['Bright Sparks', 'Winglish'];
// Escala de satisfacción general (1-5); undefined = sin calificar.
export interface Carita { v: number; emoji: string; label: string; }
export const SATISFACCION: Carita[] = [
  { v: 1, emoji: '😠', label: 'Enojado' },
  { v: 2, emoji: '🙁', label: 'Triste' },
  { v: 3, emoji: '😐', label: 'Serio' },
  { v: 4, emoji: '🙂', label: 'Contento' },
  { v: 5, emoji: '😄', label: 'Muy feliz' },
];

export interface Servicio {
  tipo: ServTipo;
  estatus: Estatus;
  fechaPlan?: string;   // ISO 'YYYY-MM-DD'
  fechaReal?: string;
  nota?: string;
  // ── captura logística (módulo Rentabilidad; la llena la Responsable Logística) ──
  traslado?: boolean;       // el servicio requirió traslado/viáticos
  costoTraslado?: number;   // MXN; solo tiene sentido si traslado
  costoExterno?: number;    // MXN; honorarios cuando lo ejecuta un externo
  notaLog?: string;         // observación logística (proveedor, folio, etc.)
}

/** Serie/inglés por nivel escolar (carga masiva de BI; texto libre del CRM). */
export interface PorNivel {
  pre?: string; pri?: string; sec?: string; bach?: string;
}

export interface Colegio {
  id: string;                // estable → clave para carga CSV futura
  nombre: string;            // editable; el CSV lo sobreescribe
  campaign: Campaign;
  tier: TierKey;
  asesorId: string | null;   // null = sin asignar (lo cubren externos)
  servicios: Servicio[];     // congelados al generar
  // metadatos del colegio (opcionales, editables en la hoja del asesor)
  serie?: string;            // p.ej. Acierta, Revuela Up
  ingles?: string;           // p.ej. Bright Sparks, Winglish
  satisfaccion?: number;     // 1-5 (caritas); undefined = sin calificar
  notasGenerales?: string;
  // ── datos del CRM (carga masiva; ver docs/06-rentabilidad.md) ──
  idCrm?: string;
  clave?: string;
  valorReal?: number;        // MXN; ingreso real del colegio (base de rentabilidad)
  gerencia?: string;
  ejecutivo?: string;        // ejecutivo COMERCIAL responsable (dato de análisis; NO es el asesor)
  antiguedad?: number;       // años
  seriesNivel?: PorNivel;    // serie por nivel escolar
  inglesNivel?: PorNivel;    // inglés por nivel escolar
  otraSerie?: string;
}

export interface Asesor { id: string; nombre: string; }

// Alertas de caso crítico: el asesor las levanta desde su portal; el coordinador las ve en Planeación.
export type ProblemaKey = 'materiales' | 'atencion' | 'facturacion' | 'otros';
export const PROBLEMAS: { key: ProblemaKey; label: string }[] = [
  { key: 'materiales', label: 'Materiales' },
  { key: 'atencion', label: 'Atención' },
  { key: 'facturacion', label: 'Facturación' },
  { key: 'otros', label: 'Otros' },
];
export interface Alerta {
  id: string;
  fecha: string;        // ISO datetime (para ordenar)
  asesorId: string;
  colegioId: string;
  tipo: ProblemaKey;
  descripcion: string;
  atendida?: boolean;   // el coordinador la marca al resolverla
}

export interface PlaneacionData {
  asesores: Asesor[];
  colegios: Colegio[];
  alertas?: Alerta[];   // opcional: tableros guardados antes de las alertas no lo traen
}

/** Agrega una alerta (genera el id); devuelve un objeto nuevo. */
export function agregarAlerta(data: PlaneacionData, a: Omit<Alerta, 'id'>): PlaneacionData {
  const id = `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return { ...data, alertas: [...(data.alertas ?? []), { ...a, id }] };
}

/** Marca una alerta como atendida; devuelve un objeto nuevo. */
export function atenderAlerta(data: PlaneacionData, id: string): PlaneacionData {
  return { ...data, alertas: (data.alertas ?? []).map((a) => a.id === id ? { ...a, atendida: true } : a) };
}

/** Servicios requeridos de un colegio, derivados de la matriz del tipo (Simulador). */
export function serviciosDeTier(tier: Tier): Servicio[] {
  const out: Servicio[] = [];
  const add = (tipo: ServTipo, count: number) => {
    for (let i = 0; i < Math.round(count); i++) out.push({ tipo, estatus: 'pendiente' });
  };
  add('uso', tier.uso); add('prof', tier.prof); add('didac', tier.didac);
  return out;
}

/** Reparte vTotal colegios entre los tipos según su % de mezcla, con **restos mayores**:
 *  los conteos SIEMPRE suman exactamente vTotal. (Math.round por tipo perdía/inventaba
 *  colegios: SMART 321 daba 320 y CORE 1047 daba 1048.) Devuelve conteos alineados a `tiers`. */
export function repartirColegios(vTotal: number, tiers: Tier[]): number[] {
  const total = Math.round(vTotal);
  const sumPct = tiers.reduce((s, t) => s + t.pct, 0) || 1;
  const exactos = tiers.map((t) => total * (t.pct / sumPct));
  const out = exactos.map(Math.floor);
  let falta = total - out.reduce((a, b) => a + b, 0);
  // los sobrantes van a los restos más grandes (empates: primero en la lista)
  const orden = exactos.map((e, i) => ({ i, resto: e - Math.floor(e) })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; falta > 0 && orden.length; k = (k + 1) % orden.length, falta--) out[orden[k].i]++;
  return out;
}

/** # de colegios de un tipo en una campaña (consistente con repartirColegios). */
export function nColegios(vTotal: number, tier: Tier, tiers: Tier[]): number {
  const idx = tiers.findIndex((t) => t.key === tier.key);
  return repartirColegios(vTotal, tiers)[Math.max(0, idx)];
}

/** Genera los cupos anónimos de ambas campañas con sus servicios congelados. */
export function generateColegios(vSmart: number, tiersSmart: Tier[], vCore: number, tiersCore: Tier[]): Colegio[] {
  const out: Colegio[] = [];
  const gen = (camp: Campaign, vTotal: number, tiers: Tier[]) => {
    const counts = repartirColegios(vTotal, tiers);
    tiers.forEach((t, ti) => {
      for (let i = 1; i <= counts[ti]; i++) {
        const id = `${camp}-${t.key}-${String(i).padStart(3, '0')}`;
        out.push({ id, nombre: id, campaign: camp, tier: t.key, asesorId: null, servicios: serviciosDeTier(t) });
      }
    });
  };
  gen('SMART', vSmart, tiersSmart);
  gen('CORE', vCore, tiersCore);
  return out;
}

export function defaultAsesores(nAse: number): Asesor[] {
  return Array.from({ length: Math.max(0, Math.round(nAse)) }, (_, i) => ({ id: `ase-${i + 1}`, nombre: `Asesor ${i + 1}` }));
}

/** Tablero inicial derivado de las semillas del Simulador (DEFAULTS). */
export function defaultPlaneacion(): PlaneacionData {
  return {
    asesores: defaultAsesores(DEFAULTS.nAse),
    colegios: generateColegios(DEFAULTS.vSmart, DEFAULTS.tiersSmart, DEFAULTS.vCore, DEFAULTS.tiersCore),
  };
}

/** Asigna (o quita, con asesorId=null) un conjunto de colegios; devuelve un arreglo nuevo. */
export function asignar(colegios: Colegio[], ids: Set<string>, asesorId: string | null): Colegio[] {
  return colegios.map((c) => (ids.has(c.id) ? { ...c, asesorId } : c));
}

export interface Resumen { total: number; asignados: number; sinAsignar: number; }
export function resumen(colegios: Colegio[]): Resumen {
  const asignados = colegios.reduce((s, c) => s + (c.asesorId ? 1 : 0), 0);
  return { total: colegios.length, asignados, sinAsignar: colegios.length - asignados };
}

/** Asigna a `asesorId` los primeros `count` cupos SIN asignar de (campaña, tipo). */
export function asignarPorTipo(colegios: Colegio[], campaign: Campaign, tier: TierKey, count: number, asesorId: string): Colegio[] {
  const ids = new Set<string>();
  for (const c of colegios) {
    if (ids.size >= count) break;
    if (c.campaign === campaign && c.tier === tier && c.asesorId === null) ids.add(c.id);
  }
  return asignar(colegios, ids, asesorId);
}

/** Libera (deja sin asignar) los primeros `count` cupos de (campaña, tipo) que tenga `asesorId`. */
export function liberarPorTipo(colegios: Colegio[], campaign: Campaign, tier: TierKey, count: number, asesorId: string): Colegio[] {
  const ids = new Set<string>();
  for (const c of colegios) {
    if (ids.size >= count) break;
    if (c.campaign === campaign && c.tier === tier && c.asesorId === asesorId) ids.add(c.id);
  }
  return asignar(colegios, ids, null);
}

/** Cuenta cupos por (campaña, tipo). Con `asesorId` undefined cuenta los SIN asignar. */
export function contarPorTipo(colegios: Colegio[], campaign: Campaign, tier: TierKey, asesorId?: string | null): number {
  return colegios.reduce((s, c) => {
    if (c.campaign !== campaign || c.tier !== tier) return s;
    if (asesorId === undefined) return s + (c.asesorId === null ? 1 : 0);
    return s + (c.asesorId === asesorId ? 1 : 0);
  }, 0);
}

/** Actualiza un servicio (por índice) de un colegio; devuelve un arreglo nuevo (inmutable). */
export function setServicio(colegios: Colegio[], colegioId: string, idx: number, patch: Partial<Servicio>): Colegio[] {
  return colegios.map((c) => c.id !== colegioId ? c
    : { ...c, servicios: c.servicios.map((s, i) => i === idx ? { ...s, ...patch } : s) });
}

/** Renombra un colegio (útil antes de la carga CSV con nombres reales). */
export function renombrarColegio(colegios: Colegio[], id: string, nombre: string): Colegio[] {
  return colegios.map((c) => c.id === id ? { ...c, nombre } : c);
}

/** Renombra un asesor; el nombre se refleja en toda la app (deriva de aquí). */
export function renombrarAsesor(asesores: Asesor[], id: string, nombre: string): Asesor[] {
  return asesores.map((a) => a.id === id ? { ...a, nombre } : a);
}

/** Actualiza metadatos de un colegio (serie, inglés, satisfacción, notas…); devuelve arreglo nuevo. */
export function patchColegio(colegios: Colegio[], id: string, patch: Partial<Colegio>): Colegio[] {
  return colegios.map((c) => c.id === id ? { ...c, ...patch } : c);
}

export interface Carga { colegios: number; servicios: number; realizados: number; usoProf: number; }
export function cargaAsesor(colegios: Colegio[], asesorId: string): Carga {
  let cols = 0, servicios = 0, realizados = 0, usoProf = 0;
  for (const c of colegios) {
    if (c.asesorId !== asesorId) continue;
    cols++;
    for (const s of c.servicios) {
      servicios++;
      if (s.estatus === 'realizado') realizados++;
      if (s.tipo !== 'didac') usoProf++;   // didácticas las hacen externos aunque el colegio esté asignado
    }
  }
  return { colegios: cols, servicios, realizados, usoProf };
}

// ---- Agenda / urgencia (usabilidad de la hoja del asesor) ----

/** Fecha local de hoy en ISO 'YYYY-MM-DD'. */
export function hoyISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Suma días a una fecha ISO (aritmética en UTC para no saltar por horario de verano). */
export function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export type Urgencia = 'realizado' | 'vencido' | 'proximo' | 'agendado' | 'sinfecha';
/** Clasifica un servicio para resaltarlo: vencido (fecha planeada pasada sin hacer), próximo (≤7 días), etc. */
export function urgencia(s: Servicio, hoy: string): Urgencia {
  if (s.estatus === 'realizado') return 'realizado';
  if (!s.fechaPlan) return 'sinfecha';
  if (s.fechaPlan < hoy) return 'vencido';
  if (s.fechaPlan <= sumarDias(hoy, 7)) return 'proximo';
  return 'agendado';
}

export interface AgendaResumen { vencidos: number; estaSemana: number; porHacer: number; }
export function agendaAsesor(colegios: Colegio[], asesorId: string, hoy: string): AgendaResumen {
  let vencidos = 0, estaSemana = 0, porHacer = 0;
  for (const c of colegios) {
    if (c.asesorId !== asesorId) continue;
    for (const s of c.servicios) {
      if (s.estatus === 'realizado') continue;
      porHacer++;
      const u = urgencia(s, hoy);
      if (u === 'vencido') vencidos++;
      else if (u === 'proximo') estaSemana++;
    }
  }
  return { vencidos, estaSemana, porHacer };
}

export interface ServicioRef {
  colegioId: string; colegioNombre: string; campaign: Campaign; tier: TierKey;
  serie?: string; ingles?: string; satisfaccion?: number;
  idx: number; servicio: Servicio;
}
/** Aplana los servicios de un asesor (para la vista agenda). */
export function serviciosDeAsesor(colegios: Colegio[], asesorId: string): ServicioRef[] {
  const out: ServicioRef[] = [];
  for (const c of colegios) {
    if (c.asesorId !== asesorId) continue;
    c.servicios.forEach((servicio, idx) => out.push({
      colegioId: c.id, colegioNombre: c.nombre, campaign: c.campaign, tier: c.tier,
      serie: c.serie, ingles: c.ingles, satisfaccion: c.satisfaccion, idx, servicio,
    }));
  }
  return out;
}

export interface Avance { colegios: number; servicios: number; realizados: number; usoProf: number; didac: number; }
/** Avance agregado sobre los colegios ASIGNADOS (lo que ejecutan los empleados). */
export function avanceAsignado(colegios: Colegio[]): Avance {
  let cols = 0, servicios = 0, realizados = 0, usoProf = 0, didac = 0;
  for (const c of colegios) {
    if (!c.asesorId) continue;
    cols++;
    for (const s of c.servicios) {
      servicios++;
      if (s.estatus === 'realizado') realizados++;
      if (s.tipo === 'didac') didac++; else usoProf++;
    }
  }
  return { colegios: cols, servicios, realizados, usoProf, didac };
}

// ════════════════════════════════════════════════════════════════════
// Carga masiva de colegios (archivo de BI) — ver docs/06-rentabilidad.md
// ════════════════════════════════════════════════════════════════════

/** Una fila ya validada del archivo de BI (el parseo/mapeo vive en lib/importColegios). */
export interface FilaColegio {
  nombre: string;
  campaign: Campaign;
  tier: TierKey;
  idCrm?: string; clave?: string; valorReal?: number;
  gerencia?: string;
  ejecutivo?: string;      // ejecutivo comercial (queda como dato del colegio)
  asesorPed?: string;      // asesor pedagógico → se casa/crea como asesor y recibe el colegio
  antiguedad?: number;
  seriesNivel?: PorNivel; inglesNivel?: PorNivel; otraSerie?: string;
}

export interface ImportResumen {
  colegios: number;                    // colegios importados
  asesoresNuevos: number;              // creados a partir de «Asesor Pedagógico»
  asignados: number;                   // colegios que quedaron con asesor
  porCampaign: Record<Campaign, number>;
}

/** Nombre normalizado para casar ejecutivos con asesores (acentos/espacios/caja). */
const normNombre = (s: string): string =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

const slug = (s: string): string => normNombre(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Reemplaza los cupos simulados por el catálogo real de BI. Los servicios de cada
 *  colegio salen de su campaña+categoría (misma matriz del Simulador). Cada
 *  «Asesor Pedagógico» se casa con un asesor existente por nombre o se crea, y el
 *  colegio queda asignado a él (así se propaga a las hojas de asesores). El
 *  «Ejecutivo Responsable» es la figura COMERCIAL: se guarda como dato del colegio
 *  para análisis/filtros y nunca se convierte en asesor. */
export function importarColegios(data: PlaneacionData, filas: FilaColegio[]): { data: PlaneacionData; resumen: ImportResumen } {
  const asesores = [...data.asesores];
  const porNombre = new Map(asesores.map((a) => [normNombre(a.nombre), a.id]));
  const idsUsados = new Set<string>();
  const colegios: Colegio[] = [];
  let asesoresNuevos = 0, asignados = 0;
  const porCampaign: Record<Campaign, number> = { SMART: 0, CORE: 0 };

  for (const f of filas) {
    const tiers = f.campaign === 'SMART' ? DEFAULTS.tiersSmart : DEFAULTS.tiersCore;
    const seed = tiers.find((t) => t.key === f.tier) ?? tiers[0];

    // id estable: primero el id de CRM, luego la clave, luego el nombre
    let id = f.idCrm ? `crm-${slug(f.idCrm)}` : f.clave ? `cve-${slug(f.clave)}` : `imp-${slug(f.nombre)}`;
    for (let n = 2; idsUsados.has(id); n++) id = `${id.replace(/~\d+$/, '')}~${n}`;
    idsUsados.add(id);

    // asesor pedagógico → asesor (crea si no existe); el ejecutivo comercial NO asigna
    let asesorId: string | null = null;
    if (f.asesorPed?.trim()) {
      const key = normNombre(f.asesorPed);
      asesorId = porNombre.get(key) ?? null;
      if (!asesorId) {
        asesorId = `ase-imp-${slug(f.asesorPed)}`;
        asesores.push({ id: asesorId, nombre: f.asesorPed.trim() });
        porNombre.set(key, asesorId);
        asesoresNuevos++;
      }
      asignados++;
    }

    porCampaign[f.campaign]++;
    colegios.push({
      id, nombre: f.nombre, campaign: f.campaign, tier: f.tier, asesorId,
      servicios: serviciosDeTier(seed),
      idCrm: f.idCrm, clave: f.clave, valorReal: f.valorReal,
      gerencia: f.gerencia, ejecutivo: f.ejecutivo, antiguedad: f.antiguedad,
      seriesNivel: f.seriesNivel, inglesNivel: f.inglesNivel, otraSerie: f.otraSerie,
    });
  }

  return {
    data: { ...data, asesores, colegios },
    resumen: { colegios: colegios.length, asesoresNuevos, asignados, porCampaign },
  };
}

// ════════════════════════════════════════════════════════════════════
// Rentabilidad — valor real del colegio vs costos de sus servicios.
// El Simulador estima ex-ante (CostInputs); aquí se captura lo REAL:
// la Responsable Logística marca traslado/costos por servicio.
// ════════════════════════════════════════════════════════════════════

export type Ejecutor = 'interno' | 'externo';

/** Quién ejecuta: didácticas SIEMPRE externos; uso/prof internos solo si el
 *  colegio tiene asesor asignado (sin asesor lo cubre un externo). */
export function ejecutorDe(s: Servicio, c: Colegio): Ejecutor {
  return s.tipo === 'didac' || !c.asesorId ? 'externo' : 'interno';
}

/** Costo real capturado de un servicio: traslado (si lo hubo) + honorarios externos. */
export function costoServicio(s: Servicio): number {
  return (s.traslado ? (s.costoTraslado ?? 0) : 0) + (s.costoExterno ?? 0);
}

export interface RentColegio {
  valor: number | null;    // null = sin Valor Real (p.ej. cupos simulados)
  costo: number;
  margen: number | null;
  pct: number | null;      // margen/valor ×100
  servicios: number; realizados: number; conCosto: number; externos: number;
}

export function rentabilidadColegio(c: Colegio): RentColegio {
  let costo = 0, realizados = 0, conCosto = 0, externos = 0;
  for (const s of c.servicios) {
    const cs = costoServicio(s);
    costo += cs;
    if (cs > 0) conCosto++;
    if (s.estatus === 'realizado') realizados++;
    if (ejecutorDe(s, c) === 'externo') externos++;
  }
  const valor = typeof c.valorReal === 'number' ? c.valorReal : null;
  const margen = valor === null ? null : valor - costo;
  const pct = valor ? ((valor - costo) / valor) * 100 : null;
  return { valor, costo, margen, pct, servicios: c.servicios.length, realizados, conCosto, externos };
}

export interface RentGrupo {
  key: string; label: string;
  colegios: number; sinValor: number;   // colegios sin Valor Real (fuera del margen)
  valor: number; costo: number; margen: number;
  servicios: number; realizados: number;
}

/** Agrega rentabilidad por una llave (gerencia, asesor, campaña…). El valor y el
 *  margen solo suman colegios CON Valor Real; el costo suma todos. */
export function agruparRent(colegios: Colegio[], llave: (c: Colegio) => string): RentGrupo[] {
  const map = new Map<string, RentGrupo>();
  for (const c of colegios) {
    const k = llave(c) || '(sin dato)';
    const g = map.get(k) ?? { key: k, label: k, colegios: 0, sinValor: 0, valor: 0, costo: 0, margen: 0, servicios: 0, realizados: 0 };
    const r = rentabilidadColegio(c);
    g.colegios++;
    g.costo += r.costo;
    g.servicios += r.servicios;
    g.realizados += r.realizados;
    if (r.valor === null) g.sinValor++;
    else { g.valor += r.valor; g.margen += r.valor - r.costo; }
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor || a.label.localeCompare(b.label));
}

/** Una fila de la hoja logística: un servicio con su colegio y ejecutor derivado. */
export interface FilaLogistica {
  colegio: Colegio;
  idx: number;          // índice del servicio dentro del colegio (para setServicio)
  servicio: Servicio;
  ejecutor: Ejecutor;
}

/** Aplana todos los servicios del tablero para la hoja de la Responsable Logística. */
export function filasLogistica(colegios: Colegio[]): FilaLogistica[] {
  const out: FilaLogistica[] = [];
  for (const c of colegios) {
    c.servicios.forEach((s, idx) => out.push({ colegio: c, idx, servicio: s, ejecutor: ejecutorDe(s, c) }));
  }
  return out;
}
