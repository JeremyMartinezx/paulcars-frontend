import { Cliente } from './cliente.model';
import { Vehiculo, VehiculoUnidad } from './vehiculo.model';

export interface EstadoAlquilerCatalogo {
  idEstadoAlquiler: number;
  nombreEstado: string;
}

export interface Alquiler {
  idAlquiler?: number;
  cliente: Cliente;
  vehiculo: Vehiculo;
  vehiculoUnidad?: VehiculoUnidad | null;
  placa?: string | null;
  fechaReserva?: string;
  fechaInicio: string;
  fechaFinEstimada: string;
  fechaFinReal?: string | null;
  sedeRecojo?: string;
  sedeDevolucion?: string;
  horaRecojo?: string;
  horaDevolucion?: string;
  dias?: number;
  precioBase?: number;
  montoExtras?: number;
  precioTotal?: number;
  serviciosExtras?: string;
  estado: EstadoAlquilerCatalogo;

  // Liquidación técnica (check-out)
  garantiaRetenida?: number | null;
  garantiaLiberada?: number | null;
  fechaCheckout?: string | null;
  actaObservaciones?: string | null;

  // Rechazo formal
  motivoRechazo?: string | null;
  observacionRechazo?: string | null;
}

// Body de POST /api/alquileres/counter
export interface AlquilerCounterRequest {
  idCliente: number;
  idVehiculo: number;
  fechaInicio: string;
  fechaFin: string;
  sedeRecojo?: string;
  sedeDevolucion?: string;
  horaRecojo?: string;
  horaDevolucion?: string;
  seguroTodoRiesgo: boolean;
  conductorAdicional: boolean;
  sillaBebe: boolean;
}

export type MotivoRechazo =
  | 'DNI_NO_COINCIDE'
  | 'LICENCIA_VENCIDA_INVALIDA'
  | 'HISTORIAL_NEGATIVO'
  | 'SIN_DISPONIBILIDAD_FLOTA'
  | 'INCUMPLIMIENTO_POLITICA_EDAD';

export interface RechazoReservaRequest {
  motivo: MotivoRechazo;
  observaciones?: string;
}
