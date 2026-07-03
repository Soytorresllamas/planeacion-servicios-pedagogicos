// Genera public/plantilla-colegios.xlsx: la plantilla que llena Inteligencia de
// Negocio para la carga masiva de colegios. Correr con: node scripts/plantilla-colegios.mjs
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HEADERS = [
  'Nombre de Colegio', 'ID en CRM', 'Clave de Colegio', 'Campaña', 'Categoría de Colegio',
  'Valor Real de Colegio', 'Gerencia Responsable', 'Ejecutivo Responsable', 'Asesor Pedagógico',
  'Años de Antigüedad',
  'Serie Preescolar', 'Serie Primaria', 'Serie Secundaria', 'Bachillerato',
  'Inglés Preescolar', 'Inglés Primaria', 'Inglés Secundaria', 'Inglés Bachillerato', 'Otra Serie',
];

// Filas de ejemplo (borrarlas antes de la carga real). Nótese que el ejecutivo
// comercial y el asesor pedagógico son personas distintas.
const EJEMPLOS = [
  ['Instituto Cumbres del Valle', 'CRM-000123', 'MX-0451', 'SMART', 'Top', 985000, 'Gerencia Centro', 'Mariana López', 'Laura Sánchez', 12,
    'Acierta', 'Acierta', 'Acierta', '', 'Bright Sparks', 'Bright Sparks', 'Winglish', '', ''],
  ['Colegio Nuevo Amanecer', 'CRM-000348', 'MX-1102', 'CORE', 'Medio', 310000, 'Gerencia Norte', 'Jorge Ramírez', 'Pedro Gómez', 5,
    '', 'Revuela Up', 'Revuela Up', '', '', 'Winglish', 'Winglish', '', ''],
  ['Centro Escolar Monte Albán', 'CRM-000891', 'MX-0779', 'CORE', 'Bajo', 145000, 'Gerencia Sur', 'Jorge Ramírez', 'Pedro Gómez', 22,
    '', 'Revuela Up', '', '', '', '', '', '', 'Serie legada 2019'],
];

const INSTRUCCIONES = [
  ['Columna', '¿Obligatoria?', 'Valores válidos', 'Notas'],
  ['Nombre de Colegio', 'Sí', 'Texto', 'Nombre oficial como aparece en CRM.'],
  ['ID en CRM', 'Recomendada', 'Texto/número', 'Identificador único en CRM; se usa como clave interna estable.'],
  ['Clave de Colegio', 'No', 'Texto', 'Clave operativa de SM, si existe.'],
  ['Campaña', 'Sí', 'SMART o CORE', 'Define la campaña a la que pertenece el colegio.'],
  ['Categoría de Colegio', 'Sí', 'Top, Alto, Medio o Bajo', 'Determina los servicios que recibe (matriz del modelo: Top 3/2/1, Alto 2/2/1, Medio 1/1/1, Bajo 1/1/0).'],
  ['Valor Real de Colegio', 'Recomendada', 'Número (MXN)', 'Ingreso anual real; es la base del módulo de Rentabilidad. Sin símbolos: 985000 o 985,000.'],
  ['Gerencia Responsable', 'Recomendada', 'Texto', 'Para filtrar y agrupar la rentabilidad por gerencia.'],
  ['Ejecutivo Responsable', 'Recomendada', 'Texto (nombre completo)', 'Ejecutivo COMERCIAL responsable del colegio. Queda como dato para análisis y filtros; NO es el asesor pedagógico y no asigna servicios.'],
  ['Asesor Pedagógico', 'Recomendada', 'Texto (nombre completo)', 'Asesor que atiende los servicios pedagógicos. Se convierte en el asesor del colegio: si no existe se crea y el colegio queda asignado a él.'],
  ['Años de Antigüedad', 'No', 'Número', 'Años como cliente de SM.'],
  ['Serie Preescolar', 'No', 'Texto', 'Serie que usa en ese nivel (vacío = no aplica).'],
  ['Serie Primaria', 'No', 'Texto', ''],
  ['Serie Secundaria', 'No', 'Texto', ''],
  ['Bachillerato', 'No', 'Texto', 'Serie de bachillerato (vacío = no aplica).'],
  ['Inglés Preescolar', 'No', 'Texto', 'Programa de inglés en ese nivel.'],
  ['Inglés Primaria', 'No', 'Texto', ''],
  ['Inglés Secundaria', 'No', 'Texto', ''],
  ['Inglés Bachillerato', 'No', 'Texto', ''],
  ['Otra Serie', 'No', 'Texto', 'Cualquier otra serie no contemplada arriba.'],
  [],
  ['Formato', '', '', 'Una fila por colegio. No cambiar los encabezados. Se acepta .xlsx o .csv (UTF-8).'],
  ['Ejemplos', '', '', 'Las 3 filas de la hoja «Colegios» son de ejemplo: bórrenlas antes de entregar.'],
];

const wb = XLSX.utils.book_new();

const wsCol = XLSX.utils.aoa_to_sheet([HEADERS, ...EJEMPLOS]);
wsCol['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
XLSX.utils.book_append_sheet(wb, wsCol, 'Colegios');

const wsIns = XLSX.utils.aoa_to_sheet(INSTRUCCIONES);
wsIns['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 26 }, { wch: 95 }];
XLSX.utils.book_append_sheet(wb, wsIns, 'Instrucciones');

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'plantilla-colegios.xlsx');
XLSX.writeFile(wb, out);
console.log('Plantilla generada:', out);
