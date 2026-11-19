// Daños del vehículo: inspección de entrega y de recepción, tasación del administrador y deuda

export type MomentoDano = 'ENTREGA' | 'RECEPCION';

export const ZONAS_DANO: { valor: string; etiqueta: string }[] = [
  { valor: 'FRENTE', etiqueta: 'Frontal' },
  { valor: 'LATERAL_IZQUIERDO', etiqueta: 'Lateral izquierda' },
  { valor: 'LATERAL_DERECHO', etiqueta: 'Lateral derecha' },
  { valor: 'POSTERIOR', etiqueta: 'Posterior' },
  { valor: 'TECHO', etiqueta: 'Techo' },
  { valor: 'LUNAS', etiqueta: 'Lunas' },
  { valor: 'LLANTAS', etiqueta: 'Llantas' },
  { valor: 'INTERIOR', etiqueta: 'Interior' },
  { valor: 'OTRO', etiqueta: 'Otra zona' }
];

export const TIPOS_DANO: { valor: string; etiqueta: string }[] = [
  { valor: 'RAYON', etiqueta: 'Rayón' },
  { valor: 'ABOLLADURA', etiqueta: 'Abolladura' },
  { valor: 'ROTURA', etiqueta: 'Rotura' },
  { valor: 'FALTANTE', etiqueta: 'Faltante' },
  { valor: 'OTRO', etiqueta: 'Otro' }
];

export const GRAVEDADES_DANO: { valor: string; etiqueta: string; ayuda: string }[] = [
  { valor: 'LEVE', etiqueta: 'Leve', ayuda: 'Estético, no afecta el uso' },
  { valor: 'MODERADO', etiqueta: 'Moderado', ayuda: 'Requiere reparación en taller' },
  { valor: 'GRAVE', etiqueta: 'Grave', ayuda: 'Afecta la seguridad o el funcionamiento' }
];

function etiqueta(lista: { valor: string; etiqueta: string }[], valor?: string | null): string {
  return lista.find((x) => x.valor === valor)?.etiqueta ?? (valor ?? '');
}

export const etiquetaZona = (v?: string | null) => etiqueta(ZONAS_DANO, v);
export const etiquetaTipoDano = (v?: string | null) => etiqueta(TIPOS_DANO, v);
export const etiquetaGravedad = (v?: string | null) => etiqueta(GRAVEDADES_DANO, v);

// Lo que registra el asesor al entregar o al recibir
export interface DanoRequest {
  zona: string;
  tipo: string;
  gravedad: string;
  descripcion: string;
  fotoUrl: string;
}

export interface Dano extends DanoRequest {
  idDano: number;
  momento: MomentoDano;
  registradoPor?: string | null;
  fechaRegistro?: string | null;
  costoReparacion?: number | null;
}

export interface TasacionRequest {
  costos: { idDano: number; costo: number }[];
  // Solo ante una exclusión del Seguro Todo Riesgo (ebriedad, conductor no autorizado, uso indebido, dolo); exige motivo
  seguroNoAplica?: boolean;
  observacion?: string | null;
}

// Cómo se reparte el costo de los daños y cómo queda la garantía
export interface TasacionResultado {
  costoTotal: number;
  tieneSeguro: boolean;
  // true si el seguro cubre el daño: el cliente paga solo el deducible
  seguroAplica: boolean;
  deducible: number;
  cargoCliente: number;
  cubiertoSeguro: number;
  garantia: number;
  cargoCombustible: number;
  cargoRetraso: number;
  totalCargos: number;
  garantiaLiberada: number;
  deuda: number;
}

export interface DanosAlquiler {
  estadoDanos: 'PENDIENTE_EVALUACION' | 'EVALUADO' | null;
  tieneSeguro: boolean;
  garantia?: number | null;
  entrega: Dano[];
  recepcion: Dano[];
  tasacion?: TasacionResultado | null;
  observacionTasacion?: string | null;
  tasadoPor?: string | null;
  fechaTasacion?: string | null;
  deudaPagada: number;
  deudaPendiente: number;
}

export interface PagoDeudaRequest {
  idMetodoPago: number;
  monto?: number | null;
  montoRecibido?: number | null;
  numeroOperacion?: string | null;
}
