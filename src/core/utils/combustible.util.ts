// Niveles de combustible que se registran al entregar y al recibir un vehículo (los mismos que valida el servidor)
export interface NivelCombustible {
  valor: 'LLENO' | '3/4' | '1/2' | '1/4';
  etiqueta: string;
}

export const NIVELES_COMBUSTIBLE: NivelCombustible[] = [
  { valor: 'LLENO', etiqueta: 'Lleno' },
  { valor: '3/4', etiqueta: '3/4' },
  { valor: '1/2', etiqueta: '1/2' },
  { valor: '1/4', etiqueta: '1/4' }
];

// "LLENO" -> "Lleno"; "3/4" -> "3/4"
export function etiquetaCombustible(valor?: string | null): string {
  const n = NIVELES_COMBUSTIBLE.find((x) => x.valor === (valor || '').toUpperCase());
  return n ? n.etiqueta : valor || '—';
}

// Orden de menor a mayor (para saber si regresó con menos combustible del que salió)
export function ordenCombustible(valor?: string | null): number {
  const v = (valor || '').toUpperCase();
  return v === 'LLENO' ? 4 : v === '3/4' ? 3 : v === '1/2' ? 2 : v === '1/4' ? 1 : 0;
}
