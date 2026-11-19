// Las pantallas se refrescan solas cada pocos segundos: solo se reemplazan los datos cuando de verdad cambiaron,
// así la lista no parpadea, no pierde la fila resaltada ni cierra tooltips mientras se trabaja.
export function huboCambios(actual: unknown, nuevo: unknown): boolean {
  return JSON.stringify(actual) !== JSON.stringify(nuevo);
}
