import { Alquiler } from '../models/alquiler.model';

// Mismos plazos que en el servidor (application.properties: politica.entrega-anticipada-minutos / espera-cliente-minutos)
export const MINUTOS_ENTREGA_ANTICIPADA = 30;
export const MINUTOS_ESPERA_CLIENTE = 60;
// Topes de sensatez del odómetro (politica.km-maximo-salto-entrega / km-maximo-por-dia): evitan errores de digitación
export const KM_MAXIMO_SALTO_ENTREGA = 500;
// Con este margen o menos para su mantenimiento, la unidad no vuelve a salir al recibirla (politica.km-margen-mantenimiento)
export const KM_MARGEN_MANTENIMIENTO = 500;
export const KM_MAXIMO_POR_DIA = 1500;

// Hora pactada de recojo como fecha y hora (la hora por defecto es 10:00, igual que en el servidor)
export function recojoPactado(a: Pick<Alquiler, 'fechaInicio' | 'horaRecojo'>): Date | null {
  if (!a.fechaInicio) return null;
  const hora = (a.horaRecojo || '10:00').slice(0, 5);
  const d = new Date(`${a.fechaInicio}T${hora}:00`);
  return isNaN(d.getTime()) ? null : d;
}

// ¿Todavía es muy temprano para entregar? (antes de la ventana de entrega anticipada)
export function entregaAunNoHabilitada(a: Pick<Alquiler, 'fechaInicio' | 'horaRecojo'>, ahora = new Date()): boolean {
  const pactada = recojoPactado(a);
  return !!pactada && ahora.getTime() < pactada.getTime() - MINUTOS_ENTREGA_ANTICIPADA * 60000;
}

// "12/11/2026 a las 13:30": desde cuándo se habilita la entrega
export function textoEntregaDesde(a: Pick<Alquiler, 'fechaInicio' | 'horaRecojo'>): string {
  const pactada = recojoPactado(a);
  if (!pactada) return '';
  const desde = new Date(pactada.getTime() - MINUTOS_ENTREGA_ANTICIPADA * 60000);
  const dd = String(desde.getDate()).padStart(2, '0');
  const mm = String(desde.getMonth() + 1).padStart(2, '0');
  const hh = String(desde.getHours()).padStart(2, '0');
  const mi = String(desde.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${desde.getFullYear()} a las ${hh}:${mi}`;
}
