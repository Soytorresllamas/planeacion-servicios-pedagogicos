// PDFs de reservas (hotel/transporte) en Supabase Storage, bucket privado
// «psp-reservas». El blob de planeación solo guarda el PATH del archivo
// (Servicio.pdfHotel / pdfTransporte); los bytes viven aquí. RLS del bucket:
// leen los usuarios activos; suben/borran solo viajes/admin.
// Ver supabase_actualizacion_v3_2.sql y docs/08-logistica-viajes.md.
import { supabase } from './supabase';

export const BUCKET_RESERVAS = 'psp-reservas';
export type TipoReserva = 'hotel' | 'transporte';
export const MAX_PDF_MB = 10;

/** Valida el archivo ANTES de subirlo (el bucket lo impone igual del lado servidor). */
export function validarPdf(file: File): string | null {
  const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!esPdf) return 'Solo se aceptan archivos PDF.';
  if (file.size > MAX_PDF_MB * 1024 * 1024) return `El PDF pesa más de ${MAX_PDF_MB} MB.`;
  if (file.size === 0) return 'El archivo está vacío.';
  return null;
}

/** Nombre único e imposible de adivinar; el path es el único puntero al archivo. */
const nombreUnico = (tipo: TipoReserva): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${tipo}/${Date.now().toString(36)}-${rand}.pdf`;
};

export type SubirResultado = { ok: true; path: string } | { ok: false; error: string };

/** Sube el PDF de una reserva; devuelve el path a guardar en el servicio. */
export async function subirReserva(file: File, tipo: TipoReserva): Promise<SubirResultado> {
  const invalido = validarPdf(file);
  if (invalido) return { ok: false, error: invalido };
  try {
    const path = nombreUnico(tipo);
    const { error } = await supabase.storage.from(BUCKET_RESERVAS)
      .upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (error) {
      const msg = /policy|denied|unauthorized|403/i.test(error.message)
        ? 'Tu cuenta no puede cargar reservas (solo Responsable de Viajes o admin).'
        : `No se pudo subir: ${error.message}`;
      return { ok: false, error: msg };
    }
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: `No se pudo subir: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** URL firmada (1 h) para abrir/descargar el PDF; null si no hay permiso o no existe. */
export async function urlReserva(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_RESERVAS).createSignedUrl(path, 3600);
    return error ? null : (data?.signedUrl ?? null);
  } catch { return null; }
}

/** Borra el archivo (al quitar o reemplazar una reserva). Ignora errores: un
 *  huérfano en Storage es preferible a bloquear el flujo. */
export async function borrarReserva(path: string): Promise<void> {
  try { await supabase.storage.from(BUCKET_RESERVAS).remove([path]); } catch { /* noop */ }
}
