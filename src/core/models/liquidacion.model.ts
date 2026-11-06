// Contratos del modal de Check-out e Inspección Técnica

export interface CheckoutRequest {
  fechaDevolucion: string;
  horaDevolucion: string;
  garantiaRetenida?: number | null;
  observaciones?: string | null;
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
}
