// Parseo del archivo de carga masiva de colegios (CSV o Excel) de BI.
// El mapeo fila→FilaColegio es lógica pura y testeable; la lectura del File
// vive al final (XLSX se importa dinámicamente para no engordar el bundle).
import type { Campaign, TierKey } from '../data/model';
import type { FilaColegio, PorNivel } from '../data/planeacion';

/** Encabezado normalizado: minúsculas, sin acentos, espacios colapsados. */
export const normHeader = (s: string): string =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

// Alias aceptados por columna (todas las variantes ya normalizadas).
const ALIAS: Record<string, string[]> = {
  nombre:     ['nombre de colegio', 'nombre del colegio', 'nombre', 'colegio'],
  idCrm:      ['id en crm', 'id crm', 'idcrm', 'id'],
  clave:      ['clave de colegio', 'clave del colegio', 'clave'],
  campaign:   ['campana', 'campania', 'campaign'],
  tier:       ['categoria de colegio', 'categoria del colegio', 'categoria', 'tipo de colegio'],
  valorReal:  ['valor real de colegio', 'valor real del colegio', 'valor real', 'valor'],
  gerencia:   ['gerencia responsable', 'gerencia'],
  // dos figuras DISTINTAS: el ejecutivo comercial (dato) y el asesor pedagógico (asigna)
  ejecutivo:  ['ejecutivo responsable', 'ejecutivo comercial responsable', 'ejecutivo comercial', 'ejecutivo'],
  asesorPed:  ['asesor pedagogico', 'asesor pedagogico responsable', 'asesor'],
  antiguedad: ['anos de antiguedad', 'anios de antiguedad', 'antiguedad'],
  seriePre:   ['serie preescolar'],
  seriePri:   ['serie primaria'],
  serieSec:   ['serie secundaria'],
  serieBach:  ['bachillerato', 'serie bachillerato'],
  inglesPre:  ['ingles preescolar'],
  inglesPri:  ['ingles primaria'],
  inglesSec:  ['ingles secundaria'],
  inglesBach: ['ingles bachillerato'],
  otraSerie:  ['otra serie', 'otras series'],
};

const CAMPAIGNS: Record<string, Campaign> = { smart: 'SMART', core: 'CORE' };
const TIERS: Record<string, TierKey> = {
  top: 'top', alto: 'alto', medio: 'medio', bajo: 'bajo',
  // por si BI manda numerado (tipo 1..4, como en el modelo)
  '1': 'top', '2': 'alto', '3': 'medio', '4': 'bajo',
  'tipo 1': 'top', 'tipo 2': 'alto', 'tipo 3': 'medio', 'tipo 4': 'bajo',
};

/** '$1,234,567.50' | '1 234 567' → número; vacío/inválido → undefined. */
export const parseNum = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? '').replace(/[$\s,]/g, '').replace(/^\((.+)\)$/, '-$1');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const texto = (v: unknown): string | undefined => {
  const s = String(v ?? '').trim();
  return s ? s : undefined;
};

export interface MapeoResultado {
  filas: FilaColegio[];
  errores: string[];     // una entrada por fila rechazada (con motivo)
  total: number;         // filas leídas (sin contar encabezado)
}

/** Convierte registros crudos {encabezado→valor} en FilaColegio validadas. */
export function mapearFilas(registros: Record<string, unknown>[]): MapeoResultado {
  const filas: FilaColegio[] = [];
  const errores: string[] = [];

  registros.forEach((reg, i) => {
    // índice del registro por columna canónica
    const porCampo = new Map<string, unknown>();
    for (const [rawKey, val] of Object.entries(reg)) {
      const nk = normHeader(rawKey);
      for (const [campo, aliases] of Object.entries(ALIAS)) {
        if (aliases.includes(nk)) { porCampo.set(campo, val); break; }
      }
    }
    const fila = i + 2; // 1-based + encabezado, como lo ve BI en Excel

    const nombre = texto(porCampo.get('nombre'));
    if (!nombre) { errores.push(`Fila ${fila}: falta «Nombre de Colegio».`); return; }

    const campRaw = texto(porCampo.get('campaign'));
    const campaign = campRaw ? CAMPAIGNS[normHeader(campRaw)] : undefined;
    if (!campaign) { errores.push(`Fila ${fila} (${nombre}): «Campaña» debe ser SMART o CORE (venía «${campRaw ?? ''}»).`); return; }

    const tierRaw = texto(porCampo.get('tier'));
    const tier = tierRaw ? TIERS[normHeader(tierRaw)] : undefined;
    if (!tier) { errores.push(`Fila ${fila} (${nombre}): «Categoría de Colegio» debe ser Top/Alto/Medio/Bajo (venía «${tierRaw ?? ''}»).`); return; }

    const nivel = (pre: string, pri: string, sec: string, bach: string): PorNivel | undefined => {
      const o: PorNivel = { pre: texto(porCampo.get(pre)), pri: texto(porCampo.get(pri)), sec: texto(porCampo.get(sec)), bach: texto(porCampo.get(bach)) };
      return o.pre || o.pri || o.sec || o.bach ? o : undefined;
    };

    filas.push({
      nombre, campaign, tier,
      idCrm: texto(porCampo.get('idCrm')),
      clave: texto(porCampo.get('clave')),
      valorReal: parseNum(porCampo.get('valorReal')),
      gerencia: texto(porCampo.get('gerencia')),
      ejecutivo: texto(porCampo.get('ejecutivo')),
      asesorPed: texto(porCampo.get('asesorPed')),
      antiguedad: parseNum(porCampo.get('antiguedad')),
      seriesNivel: nivel('seriePre', 'seriePri', 'serieSec', 'serieBach'),
      inglesNivel: nivel('inglesPre', 'inglesPri', 'inglesSec', 'inglesBach'),
      otraSerie: texto(porCampo.get('otraSerie')),
    });
  });

  return { filas, errores, total: registros.length };
}

/** Parser CSV con comillas, saltos dentro de celdas, BOM y delimitador , o ; */
export function parseCSV(textoCsv: string): Record<string, unknown>[] {
  const src = textoCsv.replace(/^\uFEFF/, '');
  // delimitador: el más frecuente en la primera línea fuera de comillas
  const primeraLinea = src.slice(0, src.indexOf('\n') === -1 ? src.length : src.indexOf('\n'));
  const delim = (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ';' : ',';

  const filas: string[][] = [];
  let celda = '', filaAct: string[] = [], enComillas = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (enComillas) {
      if (ch === '"') {
        if (src[i + 1] === '"') { celda += '"'; i++; }
        else enComillas = false;
      } else celda += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === delim) { filaAct.push(celda); celda = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      filaAct.push(celda); celda = '';
      if (filaAct.some((c) => c.trim() !== '')) filas.push(filaAct);
      filaAct = [];
    } else celda += ch;
  }
  filaAct.push(celda);
  if (filaAct.some((c) => c.trim() !== '')) filas.push(filaAct);

  if (filas.length < 2) return [];
  const headers = filas[0].map((h) => h.trim());
  return filas.slice(1).map((f) => Object.fromEntries(headers.map((h, j) => [h, f[j] ?? ''])));
}

/** Lee un File del input (CSV directo; XLS/XLSX vía SheetJS con import dinámico). */
export async function leerArchivo(file: File): Promise<Record<string, unknown>[]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '' });
  }
  return parseCSV(await file.text());
}
