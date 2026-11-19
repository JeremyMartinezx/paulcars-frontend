import { DanoRequest } from './dano.model';
import { Cliente } from './cliente.model';
import { Vehiculo, VehiculoUnidad } from './vehiculo.model';

export interface EstadoAlquilerCatalogo {
  idEstadoAlquiler: number;
  nombreEstado: string;
}

export interface Alquiler {
  idAlquiler?: number;
  /** Hasta cuándo puede pagar el cliente (solo reservas aprobadas sin pago). */
  fechaLimitePago?: string | null;
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

  // Auditoría: cuándo se registró el proceso y cuándo cambió por última vez de estado
  fechaRegistro?: string | null;
  fechaUltimoEstado?: string | null;

  // Acta de entrega (entrega de llaves)
  fechaEntrega?: string | null;
  kmEntrega?: number | null;
  combustibleEntrega?: string | null;
  checklistEntrega?: string | null;
  observacionesEntrega?: string | null;
  entregadoPor?: string | null;

  // Liquidación técnica (check-out)
  garantiaRetenida?: number | null;
  garantiaLiberada?: number | null;
  fechaCheckout?: string | null;
  kmDevolucion?: number | null;
  combustibleDevolucion?: string | null;
  actaObservaciones?: string | null;

  // Rechazo formal
  motivoRechazo?: string | null;
  observacionRechazo?: string | null;
  motivoCancelacion?: string | null;
  observacionCancelacion?: string | null;
  fechaCancelacion?: string | null;
  canceladoPor?: string | null;
  cargoCombustible?: number | null;
  cargoRetraso?: number | null;
  // Daños del vehículo (tasación del administrador)
  estadoDanos?: 'PENDIENTE_EVALUACION' | 'EVALUADO' | null;
  costoDanos?: number | null;
  cargoDanos?: number | null;
  coberturaSeguroPct?: number | null;
  montoCubiertoSeguro?: number | null;
  minutosRetraso?: number | null;
  canceladoPorRol?: 'CLIENTE' | 'ADMINISTRADOR' | 'ASESOR' | 'SISTEMA' | null;
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

// Body de PUT /api/alquileres/{id}/entregar-llaves (acta de entrega)
export interface EntregaRequest {
  documentosVerificados: boolean;
  // Lectura del odómetro al entregar (km)
  kilometraje: number;
  // LLENO, 3/4, 1/2 o 1/4
  combustible: string;
  checklist: string[];
  observaciones?: string | null;
  // Hora real (HH:mm) a la que se entregan las llaves; si no se envía, el servidor usa la hora actual
  horaEntrega?: string | null;
  // Daños que el vehículo ya tiene al entregarlo (estado inicial)
  danos?: DanoRequest[];
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

// Un cambio de estado de un alquiler: de qué estado salió, a cuál entró y cuándo
export interface HistorialEstado {
  idAlquiler: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  fechaHora: string;
}

// ───── Cancelación de reservas y cambio de vehículo ─────

export type MotivoCancelacion =
  | 'CLIENTE_SOLICITO'
  | 'NO_PAGO_EN_PLAZO'
  | 'VEHICULO_NO_DISPONIBLE'
  | 'NO_SE_PRESENTO';

export interface PreviaCancelacion {
  idAlquiler: number;
  estado: string;
  tienePagos: boolean;
  montoPagado: number;
  metodosPago: string;
  recojoPactado: string;
  horasParaRecojo: number;
  porcentajeReembolso: number;
  montoReembolso: number;
  montoRetenido: number;
  regla: string;
  puedeCancelarElUsuario: boolean;
  venceElPago: string | null;
  pagoVencido: boolean;
  plazoDevolucion: string;
}

export interface CancelarReservaRequest {
  motivo: MotivoCancelacion;
  observaciones?: string | null;
  codigoOperacion?: string | null;
}

export interface UnidadDisponible {
  placa: string;
  color: string;
  sede: string;
}

export interface ResultadoCancelacion {
  idAlquiler: number;
  montoReembolsado: number;
  notasCredito: string;
  mensaje: string;
}

// ───── Devolución de dinero de una reserva cancelada ─────

export interface NotaCreditoRef {
  idBoleta: number;
  numero: string;
  monto: number;
}

export interface Devolucion {
  idAlquiler: number;
  cancelada: boolean;
  montoPagado: number;
  montoDevuelto: number;
  montoRetenido: number;
  metodos: string;
  estado: 'SIN_DEVOLUCION' | 'EN_TRAMITE' | 'DEVUELTA';
  plazo: string;
  fechaSolicitud: string | null;
  fechaDevuelta: string | null;
  notasCredito: NotaCreditoRef[];
  mensaje: string;
  fechaEstimada: string | null;
}
