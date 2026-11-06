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

// GET /api/reportes/ejecutivo
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
  diasTotalesAlquilados: number;
  topVehiculos: FilaVehiculoReporte[];
  ingresosPorSede: FilaMonto[];
  ingresosPorCategoria: FilaMonto[];
  ingresosPorMetodo: FilaMonto[];
}

// GET /api/reportes/operativo
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
