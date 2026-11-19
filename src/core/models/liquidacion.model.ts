// Contratos del modal de Check-out e Inspección Técnica

import { Dano, DanoRequest } from './dano.model';

export interface CheckoutRequest {
  fechaDevolucion?: string;
  // Opcionales: el servidor registra la fecha y hora exactas de la recepción
  horaDevolucion?: string;
  garantiaRetenida?: number | null;
  observaciones?: string | null;
  // Lectura del odómetro al recibir el vehículo (km)
  kilometraje: number;
  // LLENO, 3/4, 1/2 o 1/4
  combustible: string;
  // Momento fijado al abrir la pantalla de recepción (hora local, sin zona): es la hora de devolución registrada
  momentoRecepcion?: string;
  // Daños nuevos encontrados al recibir el vehículo (cada uno con su foto)
  danos?: DanoRequest[];
}

// Cargos que se aplicarían al recibir el vehículo ahora mismo
export interface CargosPrevios {
  cargoCombustible: number;
  cuartosFaltantes: number;
  cargoRetraso: number;
  minutosRetraso: number;
  garantia: number;
}

// Acta de Inspección y Liquidación Final
export interface LiquidacionResponse {
  idAlquiler: number;
  cliente: string;
  documentoCliente: string;
  vehiculo: string;
  placa: string;
  categoria: string;
  garantiaRetenida: number;
  garantiaLiberada: number;
  estadoAlquiler: string;
  estadoVehiculo: string;
  estadoCliente: string;
  observaciones?: string | null;
  fechaCheckout: string;
  // Cargos de la recepción (se descuentan de la garantía)
  cargoCombustible?: number | null;
  cargoRetraso?: number | null;
  minutosRetraso?: number | null;
  totalCargos?: number | null;
  saldoPorCobrar?: number | null;
  // Si la unidad llegó a su kilometraje de mantenimiento y quedó fuera de servicio
  avisoMantenimiento?: string | null;
  // Daños: null = sin daños; PENDIENTE_EVALUACION (garantía retenida); EVALUADO
  estadoDanos?: 'PENDIENTE_EVALUACION' | 'EVALUADO' | null;
  tieneSeguro?: boolean;
  costoDanos?: number | null;
  coberturaSeguroPct?: number | null;
  montoCubiertoSeguro?: number | null;
  cargoDanos?: number | null;
  deudaPagada?: number | null;
  deudaPendiente?: number | null;
  danosEntrega?: Dano[];
  danosRecepcion?: Dano[];
}
