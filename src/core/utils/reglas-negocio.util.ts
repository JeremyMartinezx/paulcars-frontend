import { Vehiculo } from '../models/vehiculo.model';
import { MotivoRechazo, Alquiler } from '../models/alquiler.model';
import { LiquidacionResponse } from '../models/liquidacion.model';

// Mismas tarifas que TarifarioPaulCars.java (el backend recalcula todo; aquí es solo para mostrar)
export const TARIFAS = {
  seguroTodoRiesgoDia: 35,
  conductorAdicionalDia: 6.5,
  sillaBebeDia: 6.5
};

export type Categoria = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'PICKUP';

export function categoriaVehiculo(vehiculo?: Vehiculo | null): Categoria {
  const t = (vehiculo?.tipo?.nombreTipo || '').toUpperCase();
  if (t.includes('PICKUP') || t.includes('CAMIONETA')) return 'PICKUP';
  if (t.includes('SUV')) return 'SUV';
  if (t.includes('HATCH')) return 'HATCHBACK';
  return 'SEDAN';
}

// Deducible de póliza por categoría. El depósito de garantía usa el mismo monto.
export function deduciblePorCategoria(vehiculo?: Vehiculo | null): number {
  switch (categoriaVehiculo(vehiculo)) {
    case 'HATCHBACK': return 2500;
    case 'SUV': return 5000;
    case 'PICKUP': return 7000;
    default: return 3500;
  }
}

export function garantiaHold(vehiculo?: Vehiculo | null): number {
  return deduciblePorCategoria(vehiculo);
}

export const MOTIVOS_RECHAZO: { valor: MotivoRechazo; titulo: string; detalle: string }[] = [
  { valor: 'DNI_NO_COINCIDE', titulo: 'Inconsistencia en Documento de Identidad', detalle: 'Los datos del documento presentado no coinciden con el registro de la solicitud.' },
  { valor: 'LICENCIA_VENCIDA_INVALIDA', titulo: 'Licencia de Conducir No Vigente', detalle: 'La licencia se encuentra vencida o no figura habilitada ante el MTC.' },
  { valor: 'HISTORIAL_NEGATIVO', titulo: 'Observación en Historial Operativo o Crediticio', detalle: 'Reporte preventivo en centrales de riesgo o antecedentes de siniestros pendientes.' },
  { valor: 'SIN_DISPONIBILIDAD_FLOTA', titulo: 'Mantenimiento Preventivo de Flota', detalle: 'La unidad asignada ha ingresado a inspección técnica de seguridad.' },
  { valor: 'INCUMPLIMIENTO_POLITICA_EDAD', titulo: 'Criterio de Edad o Experiencia Requerida', detalle: 'No cumple con la edad mínima (21 años) o los 2 años de récord de manejo exigidos.' }
];

export function motivoRechazoLegible(valor?: string | null): string {
  const m = MOTIVOS_RECHAZO.find((x) => x.valor === valor);
  return m ? `${m.titulo} (${m.detalle})` : (valor || '');
}

export function etiquetaEstadoAlquiler(estado?: string | null): string {
  switch ((estado || '').toUpperCase()) {
    case 'PENDIENTE': return 'Solicitud pendiente';
    case 'RESERVADO':
    case 'APROBADO':
    case 'CONFIRMADO':
    case 'PAGADO':
      return 'Reservado';
    case 'ACTIVO': return 'En ruta';
    case 'FINALIZADO': return 'Finalizado';
    case 'CANCELADO': return 'Cancelado';
    case 'RECHAZADO': return 'Rechazado';
    default: return estado || '';
  }
}

/**
 * Formato unificado de referencia pública de contrato / reserva para cliente y administración:
 * Ejemplo: N° ALQ-000037
 */
export function formatearCodigoAlquiler(id?: number | string | null): string {
  if (!id) return 'N° ALQ-000000';
  const num = typeof id === 'string' ? parseInt(id.replace(/\D/g, ''), 10) : id;
  if (!num || isNaN(num)) return 'N° ALQ-000000';
  return `N° ALQ-${String(num).padStart(6, '0')}`;
}

export interface LiquidacionAlquiler {
  sedeRecojo: string;
  sedeDevolucion: string;
  horaEntregaPactada: string;
  horaDevolucionProgramada: string;
  horaDevolucionEfectiva: string;
  retrasoHoras: number;
  tarifaHoraRetraso: number;
  tarifaDia: number;
  dias: number;
  subtotalAlquiler: number;
  montoExtras: number;
  extrasTexto: string;
  totalAlquiler: number;
  estadoPago: string;
  montoRetraso: number;
  diaAdicionalPorExceso: boolean;
  percancesObservados: string;
  montoPercance: number;
  depositoGarantia: number;
  tipoVehiculo: string;
  estadoGarantia: 'EN_CUSTODIA' | 'LIBERADA_TOTAL' | 'RETENIDA_PARCIAL';
  totalPenalidades: number;
  saldoGarantiaDevuelto: number;
  estadoInspeccion: string;
  politica24hNota: string;
}

export function formatearSede(sede?: string): string {
  const s = (sede || '').toUpperCase();
  if (s.includes('AEROPUERTO')) return 'Aeropuerto Internacional Jorge Chávez';
  return 'Sede Miraflores';
}

export function calcularGarantiaPorTipo(tipo?: string): number {
  const t = (tipo || '').toUpperCase();
  if (t.includes('PICKUP') || t.includes('CAMIONETA')) return 7000;
  if (t.includes('SUV')) return 5000;
  if (t.includes('HATCHBACK') || t.includes('HATCH')) return 2500;
  return 3500;
}

export function calcularDiasAlquiler(inicioStr?: string, finStr?: string): number {
  if (!inicioStr || !finStr) return 1;
  const ini = new Date(inicioStr).getTime();
  const fin = new Date(finStr).getTime();
  const diff = Math.round((fin - ini) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

export function nombreVehiculoAlquiler(alq?: Alquiler | null, acta?: LiquidacionResponse | null): string {
  if (acta?.vehiculo && acta.vehiculo.trim() !== '') return acta.vehiculo;
  if (alq?.vehiculo?.modelo) {
    const marca = alq.vehiculo.modelo.marca?.nombreMarca || '';
    const mod = alq.vehiculo.modelo.modelo || '';
    return `${marca} ${mod}`.trim() || 'Vehículo';
  }
  return 'Vehículo';
}

export function obtenerLiquidacionAlquiler(alquiler: Alquiler, acta?: LiquidacionResponse | null): LiquidacionAlquiler {
  const tarifaDia = alquiler.vehiculo?.precioDia ? Number(alquiler.vehiculo.precioDia) : 180;
  const tarifaHora = alquiler.vehiculo?.precioHora ? Number(alquiler.vehiculo.precioHora) : 25;
  const estado = (alquiler.estado?.nombreEstado || acta?.estadoAlquiler || '').toUpperCase();

  const sedeR = formatearSede(alquiler.sedeRecojo || alquiler.vehiculo?.sede);
  const sedeD = formatearSede(alquiler.sedeDevolucion || alquiler.sedeRecojo || alquiler.vehiculo?.sede);
  const hRecojo = alquiler.horaRecojo || '09:00';
  const hDevolucion = alquiler.horaDevolucion || '18:00';

  const tipo = alquiler.vehiculo?.tipo?.nombreTipo || acta?.categoria || 'SUV';
  const garantia = calcularGarantiaPorTipo(tipo);
  const dias = (alquiler.dias && alquiler.dias > 0)
    ? alquiler.dias
    : calcularDiasAlquiler(alquiler.fechaInicio, alquiler.fechaFinEstimada);

  const subtotal = (alquiler.precioBase !== undefined && alquiler.precioBase !== null && alquiler.precioBase > 0)
    ? Number(alquiler.precioBase)
    : dias * tarifaDia;

  const montoExtras = (alquiler.montoExtras !== undefined && alquiler.montoExtras !== null)
    ? Number(alquiler.montoExtras)
    : 0;

  const total = (alquiler.precioTotal !== undefined && alquiler.precioTotal !== null && alquiler.precioTotal > 0)
    ? Number(alquiler.precioTotal)
    : (subtotal + montoExtras);

  const extrasTexto = (alquiler.serviciosExtras && alquiler.serviciosExtras.trim() !== '')
    ? alquiler.serviciosExtras
    : 'Ninguno';

  if (estado === 'CANCELADO' || estado === 'RECHAZADO') {
    return {
      sedeRecojo: sedeR,
      sedeDevolucion: sedeD,
      horaEntregaPactada: '—',
      horaDevolucionProgramada: '—',
      horaDevolucionEfectiva: '—',
      retrasoHoras: 0,
      tarifaHoraRetraso: 0,
      tarifaDia: tarifaDia,
      dias: dias,
      subtotalAlquiler: 0,
      montoExtras: 0,
      extrasTexto: 'Ninguno',
      totalAlquiler: 0,
      estadoPago: estado === 'RECHAZADO' ? 'Solicitud no aprobada' : 'Cancelado sin cargos',
      montoRetraso: 0,
      diaAdicionalPorExceso: false,
      percancesObservados: estado === 'RECHAZADO'
        ? `No aprobada: ${motivoRechazoLegible(alquiler.motivoRechazo)}`
        : 'Solicitud cancelada sin cargos.',
      montoPercance: 0,
      depositoGarantia: 0,
      tipoVehiculo: tipo,
      estadoGarantia: 'LIBERADA_TOTAL',
      totalPenalidades: 0,
      saldoGarantiaDevuelto: 0,
      estadoInspeccion: 'Sin servicio',
      politica24hNota: 'Cancelado sin cargos.'
    };
  }

  if (estado === 'PENDIENTE') {
    return {
      sedeRecojo: sedeR,
      sedeDevolucion: sedeD,
      horaEntregaPactada: `${hRecojo} hrs`,
      horaDevolucionProgramada: `${hDevolucion} hrs`,
      horaDevolucionEfectiva: 'Pendiente',
      retrasoHoras: 0,
      tarifaHoraRetraso: tarifaHora,
      tarifaDia: tarifaDia,
      dias: dias,
      subtotalAlquiler: subtotal,
      montoExtras: montoExtras,
      extrasTexto: extrasTexto,
      totalAlquiler: total,
      estadoPago: 'Pendiente de aprobación',
      montoRetraso: 0,
      diaAdicionalPorExceso: false,
      percancesObservados: 'En espera de aprobación.',
      montoPercance: 0,
      depositoGarantia: garantia,
      tipoVehiculo: tipo,
      estadoGarantia: 'EN_CUSTODIA',
      totalPenalidades: 0,
      saldoGarantiaDevuelto: 0,
      estadoInspeccion: 'Pendiente de entrega',
      politica24hNota: 'Período base de 24 horas.'
    };
  }

  if (estado === 'RESERVADO' || estado === 'APROBADO') {
    return {
      sedeRecojo: sedeR,
      sedeDevolucion: sedeD,
      horaEntregaPactada: `${hRecojo} hrs`,
      horaDevolucionProgramada: `${hDevolucion} hrs`,
      horaDevolucionEfectiva: 'Pendiente de entrega',
      retrasoHoras: 0,
      tarifaHoraRetraso: tarifaHora,
      tarifaDia: tarifaDia,
      dias: dias,
      subtotalAlquiler: subtotal,
      montoExtras: montoExtras,
      extrasTexto: extrasTexto,
      totalAlquiler: total,
      estadoPago: 'Pendiente de pago (Online o en Sede)',
      montoRetraso: 0,
      diaAdicionalPorExceso: false,
      percancesObservados: 'Reserva aprobada. Puedes realizar el pago anticipado online o en counter.',
      montoPercance: 0,
      depositoGarantia: garantia,
      tipoVehiculo: tipo,
      estadoGarantia: 'EN_CUSTODIA',
      totalPenalidades: 0,
      saldoGarantiaDevuelto: 0,
      estadoInspeccion: 'Listo para retiro en sede',
      politica24hNota: 'Período base de 24 horas.'
    };
  }

  if (estado === 'PAGADO' || estado === 'CONFIRMADO') {
    return {
      sedeRecojo: sedeR,
      sedeDevolucion: sedeD,
      horaEntregaPactada: `${hRecojo} hrs`,
      horaDevolucionProgramada: `${hDevolucion} hrs`,
      horaDevolucionEfectiva: 'Pendiente de entrega de llaves',
      retrasoHoras: 0,
      tarifaHoraRetraso: tarifaHora,
      tarifaDia: tarifaDia,
      dias: dias,
      subtotalAlquiler: subtotal,
      montoExtras: montoExtras,
      extrasTexto: extrasTexto,
      totalAlquiler: total,
      estadoPago: 'Pago anticipado acreditado • Retiro en sede',
      montoRetraso: 0,
      diaAdicionalPorExceso: false,
      percancesObservados: 'Pago de alquiler acreditado. Presenta tu DNI y brevete en sede para el depósito de garantía y entrega de llaves.',
      montoPercance: 0,
      depositoGarantia: garantia,
      tipoVehiculo: tipo,
      estadoGarantia: 'EN_CUSTODIA',
      totalPenalidades: 0,
      saldoGarantiaDevuelto: 0,
      estadoInspeccion: 'Pendiente de entrega de llaves en sede',
      politica24hNota: 'Vehículo reservado y pagado.'
    };
  }

  if (estado === 'ACTIVO') {
    return {
      sedeRecojo: sedeR,
      sedeDevolucion: sedeD,
      horaEntregaPactada: `${hRecojo} hrs`,
      horaDevolucionProgramada: `${hDevolucion} hrs`,
      horaDevolucionEfectiva: 'En curso',
      retrasoHoras: 0,
      tarifaHoraRetraso: tarifaHora,
      tarifaDia: tarifaDia,
      dias: dias,
      subtotalAlquiler: subtotal,
      montoExtras: montoExtras,
      extrasTexto: extrasTexto,
      totalAlquiler: total,
      estadoPago: 'Pagado en counter',
      montoRetraso: 0,
      diaAdicionalPorExceso: false,
      percancesObservados: 'Vehículo en circulación.',
      montoPercance: 0,
      depositoGarantia: garantia,
      tipoVehiculo: tipo,
      estadoGarantia: 'EN_CUSTODIA',
      totalPenalidades: 0,
      saldoGarantiaDevuelto: 0,
      estadoInspeccion: 'Inspección inicial conforme',
      politica24hNota: 'Tolerancia de 30 min para entrega.'
    };
  }

  // Contrato cerrado / Check-out / Finalizado
  const liberada = Number(alquiler.garantiaLiberada ?? acta?.garantiaLiberada ?? garantia);
  const observaciones = alquiler.actaObservaciones || acta?.observaciones || 'Sin observaciones. Unidad recibida en perfecto estado.';

  return {
    sedeRecojo: sedeR,
    sedeDevolucion: sedeD,
    horaEntregaPactada: `${hRecojo} hrs`,
    horaDevolucionProgramada: `${hDevolucion} hrs`,
    horaDevolucionEfectiva: alquiler.fechaFinReal || acta?.fechaCheckout || `${hDevolucion} hrs (Puntual)`,
    retrasoHoras: 0,
    tarifaHoraRetraso: tarifaHora,
    tarifaDia: tarifaDia,
    dias: dias,
    subtotalAlquiler: subtotal,
    montoExtras: montoExtras,
    extrasTexto: extrasTexto,
    totalAlquiler: total,
    estadoPago: 'Pagado y liquidado',
    montoRetraso: 0,
    diaAdicionalPorExceso: false,
    percancesObservados: observaciones,
    montoPercance: 0,
    depositoGarantia: garantia,
    tipoVehiculo: tipo,
    estadoGarantia: 'LIBERADA_TOTAL',
    totalPenalidades: 0,
    saldoGarantiaDevuelto: liberada,
    estadoInspeccion: 'Conforme (Check-out aprobado)',
    politica24hNota: 'Liquidación según acta de inspección.'
  };
}
