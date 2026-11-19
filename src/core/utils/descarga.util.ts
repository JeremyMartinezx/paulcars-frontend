// Utilidades para descargar archivos (PDF / Excel) recibidos del backend como Blob

export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Abre el PDF en una pestaña nueva para visualizarlo o imprimirlo
export function abrirPdfEnPestana(blob: Blob): void {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatearFechaHora(valor?: string | null): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const soloFecha = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  return soloFecha ? `${dd}/${mm}/${d.getFullYear()}` : `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

// Fecha y hora exacta del registro: siempre muestra la hora (dd/MM/yyyy HH:mm).
// Los registros antiguos guardados sin hora (00:00) se marcan como "sin hora" en vez de inventar una.
export function formatearFechaHoraExacta(valor?: string | null): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const fecha = `${dd}/${mm}/${d.getFullYear()}`;
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    return `${fecha} · sin hora`;
  }
  return `${fecha} - ${horaConSegundos(d)}`;
}

// "21:54:37": hora, minuto y segundo (el registro distingue operaciones hechas en el mismo minuto)
function horaConSegundos(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

// "2026-10-28" -> "28/10"; si es de otro año: "28/10/27" (así el periodo se lee sin confundirse)
export function fechaDiaMes(valor?: string | null): string {
  if (!valor) return '—';
  const [a, m, d] = valor.split('T')[0].split('-');
  if (!d || !m) return valor;
  return a && a !== String(new Date().getFullYear()) ? `${d}/${m}/${a.slice(2)}` : `${d}/${m}`;
}

// Texto de la diferencia entre la hora pactada y la real (minutos; positivo = tarde)
export function textoDiferenciaMin(min?: number | null): string {
  if (min === null || min === undefined) return '—';
  const abs = Math.abs(min);
  if (abs <= 5) return 'A tiempo';
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const dur = h > 0 ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`;
  return min > 0 ? `+${dur} tarde` : `${dur} antes`;
}

// Versión corta para tablas: "28/10 15:42". Los registros antiguos sin hora muestran "28/10 · sin hora".
export function formatearFechaHoraCorta(valor?: string | null): string {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    return `${dd}/${mm} · sin hora`;
  }
  return `${dd}/${mm} - ${horaConSegundos(d)}`;
}
