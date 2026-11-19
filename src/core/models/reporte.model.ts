export interface FilaVehiculoReporte {
  idVehiculo: number;
  vehiculo: string;
  placa: string;
  categoria: string;
  alquileres: number;
  diasAlquilados: number;
  ingresos: number;
  utilizacion: number;
}

export interface FilaMonto {
  etiqueta: string;
  cantidad: number;
  total: number;
}


export interface ReporteEjecutivo {
  desde: string;
  hasta: string;
  sede: string;
  categoria: string;
  ingresosTotales: number;
  ocupacionFlota: number;
  ticketPromedio: number;
  alquileresEnPeriodo: number;
  alquileresFinalizados: number;
  pagosPendientes: number;
  montoPendiente: number;
  diasTotalesAlquilados: number;
  topVehiculos: FilaVehiculoReporte[];
  ingresosPorSede: FilaMonto[];
  ingresosPorCategoria: FilaMonto[];
  ingresosPorMetodo: FilaMonto[];
  // "TODOS" o el vehículo elegido; con un vehículo elegido llegan también sus alquileres del periodo
  vehiculo: string;
  alquileresVehiculo: FilaAlquilerVehiculo[];
}

export interface FilaAlquilerVehiculo {
  codigo: string;
  cliente: string;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  estado: string;
  total: number;
  pagado: number;
}

export interface UnidadOpcion {
  placa: string;
  nombre: string;
  categoria: string;
  sede: string;
}


export interface ReporteOperativo {
  solicitudesPendientes: number;
  recojosHoy: number;
  devolucionesHoy: number;
  devolucionesVencidas: number;
  pagosHoy: number;
  cobradoHoy: number;
  vehiculosDisponibles: number;
  vehiculosEnMantenimiento: number;
  vehiculosEnLimpieza: number;
}


// ───── Reporte de solicitudes y alquileres ─────

export type GrupoEstadoReporte = 'PENDIENTE' | 'POR_PAGAR' | 'PAGADO' | 'EN_RUTA' | 'FINALIZADO' | 'ANULADO';

export interface FilaSolicitudReporte {
  atendidoPor?: string;
  idAlquiler: number;
  codigo: string;
  fechaRegistro: string;
  fechaUltimoEstado: string | null;
  cliente: string;
  documento: string;
  vehiculo: string;
  placa: string;
  categoria: string;
  sede: string;
  fechaRecojo: string;
  horaRecojo: string | null;
  fechaDevolucion: string;
  horaDevolucion: string | null;
  dias: number;
  grupoEstado: GrupoEstadoReporte;
  estado: string;
  estadoPago: string;
  metodosPago: string;
  montoTotal: number;
  montoPagado: number;
  saldo: number;
  fechaEntrega: string | null;
  entregadoPor: string | null;
  // Hora real de devolución, datos de la entrega de llaves y diferencia contra lo pactado (min; + = tarde)
  fechaDevolucionReal: string | null;
  kmEntrega: number | null;
  combustibleEntrega: string | null;
  difRecojoMin: number | null;
  difDevolucionMin: number | null;
}

export interface FilaPagoReporte {
  codigoContrato: string;
  recibo: string;
  fechaHora: string | null;
  cliente: string;
  metodo: string;
  canal: string;
  operacion: string;
  monto: number;
}

export interface ResumenSolicitudes {
  total: number;
  pendientes: number;
  porPagar: number;
  pagadas: number;
  enRuta: number;
  finalizadas: number;
  anuladas: number;
  montoContratado: number;
  montoCobrado: number;
  saldoPorCobrar: number;
}

export interface FilaVehiculoSolicitado {
  vehiculo: string;
  categoria: string;
  solicitudes: number;
  monto: number;
}

export interface ReporteSolicitudes {
  desde: string;
  hasta: string;
  estado: string;
  sede: string;
  categoria: string;
  busqueda: string;
  generadoEn: string;
  generadoPor: string;
  resumen: ResumenSolicitudes;
  filas: FilaSolicitudReporte[];
  porEstado: FilaMonto[];
  porMetodoPago: FilaMonto[];
  porSede: FilaMonto[];
  vehiculosSolicitados: FilaVehiculoSolicitado[];
  pagos: FilaPagoReporte[];
}

// ───── Cierre de caja ─────

export interface FilaAsesorCaja {
  asesor: string;
  cantidad: number;
  efectivo: number;
  tarjeta: number;
  billetera: number;
  transferencia: number;
  total: number;
}

export interface DetalleCaja {
  fechaHora: string | null;
  boleta: string;
  contrato: string;
  cliente: string;
  metodo: string;
  operacion: string;
  autorizacion: string;
  asesor: string;
  monto: number;
}

export interface CierreCaja {
  fecha: string;
  generadoEn: string;
  generadoPor: string;
  porAsesor: FilaAsesorCaja[];
  totales: FilaAsesorCaja;
  detalle: DetalleCaja[];
}
