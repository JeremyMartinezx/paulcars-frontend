export interface SedeInfo {
  id: 'MIRAFLORES' | 'AEROPUERTO';
  nombre: string;
  nombreCorto: string;
  direccion: string;
  horario: string;
  es24Horas: boolean;
}

export const SEDES_DISPONIBLES: SedeInfo[] = [
  {
    id: 'MIRAFLORES',
    nombre: 'Miraflores - Av. 28 de Julio 489',
    nombreCorto: 'Miraflores - Av. 28 de Julio 489',
    direccion: 'Av. 28 de Julio 489, Miraflores',
    horario: 'Lun-Vie 08:30 a 18:00, Sáb 09:00 a 17:00 (Dom: cerrado)',
    es24Horas: false
  },
  {
    id: 'AEROPUERTO',
    nombre: 'Aeropuerto Internacional Jorge Chávez',
    nombreCorto: 'Aeropuerto Internacional Jorge Chávez',
    direccion: 'Av. Elmer Faucett s/n, Callao (Zona Rent-a-Car)',
    horario: 'Atención 24 horas, los 7 días de la semana',
    es24Horas: true
  }
];

/**
 * Retorna la lista de horarios permitidos para la sede especificada según el día de la semana.
 * Si es Aeropuerto retorna las 24 horas.
 * Si es Miraflores restringe las opciones al rango de atención permitido (08:30 a 18:00 Lun-Vie, 09:00 a 17:00 Sáb).
 */
export function obtenerHorasValidasSede(sedeId: string, fechaStr?: string): string[] {
  let horasBase: string[] = [];

  if (sedeId === 'AEROPUERTO') {
    horasBase = [
      '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
      '20:00', '21:00', '22:00', '23:00'
    ];
  } else {
    // Sede Miraflores: verificar el día de la semana
    let diaSemana = 1;
    if (fechaStr) {
      const [y, m, d] = fechaStr.split('-').map(Number);
      if (y && m && d) {
        const dateObj = new Date(y, m - 1, d);
        diaSemana = dateObj.getDay();
      }
    }

    if (diaSemana === 0) {
      // DOMINGO CERRADO: Sede Miraflores no opera los domingos
      return [];
    } else if (diaSemana === 6) {
      // Sábado: 09:00 a 17:00
      horasBase = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00'
      ];
    } else {
      // Lunes a Viernes: 08:30 a 18:00
      horasBase = [
        '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
      ];
    }
  }

  // Excluir horas que ya pasaron o que tengan menos de 1 hora (60 minutos) de anticipación
  if (fechaStr) {
    const ahora = new Date();
    const minTimestamp = ahora.getTime() + 60 * 60 * 1000; // 60 minutos de anticipación obligatoria

    horasBase = horasBase.filter((hora) => {
      const slotDt = new Date(`${fechaStr}T${hora}:00`);
      return !isNaN(slotDt.getTime()) && slotDt.getTime() >= minTimestamp;
    });
  }

  return horasBase;
}

/**
 * Encuentra el siguiente día disponible que tenga turnos válidos para la sede especificada.
 */
export function obtenerSiguienteFechaDisponible(sedeId: string, fechaDesde?: string): string {
  const base = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : new Date();
  const candidate = new Date(base);
  candidate.setDate(candidate.getDate() + 1);

  for (let i = 0; i < 14; i++) {
    const y = candidate.getFullYear();
    const m = String(candidate.getMonth() + 1).padStart(2, '0');
    const d = String(candidate.getDate()).padStart(2, '0');
    const fStr = `${y}-${m}-${d}`;

    const turnos = obtenerHorasValidasSede(sedeId, fStr);
    if (turnos.length > 0) {
      return fStr;
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  return '';
}

export interface CalculoTarifaPeriodo {
  horasTotales: number;
  ciclosCompletos24h: number;
  horasExcedentes: number;
  minutosExcedentes: number;
  diasCobrados: number;
  aplicaDiaAdicionalPorExceso: boolean;
  esPeriodoValido: boolean;
  mensajeDetalle: string;
}

export function validarHorarioSede(
  sedeId: string,
  fechaStr: string,
  horaStr: string
): { valido: boolean; mensaje?: string } {
  if (!sedeId || !fechaStr || !horaStr) {
    return { valido: false, mensaje: 'Debes seleccionar sede, fecha y hora.' };
  }

  const sede = SEDES_DISPONIBLES.find((s) => s.id === sedeId);
  if (!sede) {
    return { valido: false, mensaje: 'Sede seleccionada no válida.' };
  }

  const ahora = new Date();
  const yHoy = ahora.getFullYear();
  const mHoy = String(ahora.getMonth() + 1).padStart(2, '0');
  const dHoy = String(ahora.getDate()).padStart(2, '0');
  const hoyStr = `${yHoy}-${mHoy}-${dHoy}`;

  if (fechaStr < hoyStr) {
    return { valido: false, mensaje: 'La fecha seleccionada ya pasó. Debe ser para hoy o una fecha futura.' };
  }

  const slotDt = new Date(`${fechaStr}T${horaStr}:00`);
  if (!isNaN(slotDt.getTime())) {
    const minTimestamp = ahora.getTime() + 60 * 60 * 1000;
    if (slotDt.getTime() < minTimestamp) {
      return {
        valido: false,
        mensaje: `Las reservas requieren un mínimo de 1 hora (60 minutos) de anticipación. Para las ${horaStr} hrs no es posible reservar con menos de 60 minutos de antelación.`
      };
    }
  }

  // Aeropuerto opera 24/7 sin restricción
  if (sede.es24Horas) {
    return { valido: true };
  }

  // Validación para Sede Miraflores
  // Lun-Vie 08:30 a 18:00, Sáb 09:00 a 17:00, Dom: Cerrado
  const [y, m, d] = fechaStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const diaSemana = dateObj.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

  if (diaSemana === 0) {
    return {
      valido: false,
      mensaje: 'La Sede Miraflores se encuentra CERRADA los domingos. Te sugerimos seleccionar la sede Aeropuerto Internacional Jorge Chávez (24/7).'
    };
  }

  const [h, min] = horaStr.split(':').map(Number);
  const minutosDesdeMedianoche = h * 60 + min;

  if (diaSemana >= 1 && diaSemana <= 5) {
    // Lun - Vie: 08:30 (510 min) a 18:00 (1080 min)
    const apertura = 8 * 60 + 30; // 08:30
    const cierre = 18 * 60; // 18:00
    if (minutosDesdeMedianoche < apertura || minutosDesdeMedianoche > cierre) {
      return {
        valido: false,
        mensaje: `En Sede Miraflores el horario de atención de Lunes a Viernes es de 08:30 a 18:00 hrs. Tu hora seleccionada (${horaStr} hrs) está fuera de turno.`
      };
    }
  } else if (diaSemana === 6) {
    // Sábado: 09:00 (540 min) a 17:00 (1020 min)
    const apertura = 9 * 60; // 09:00
    const cierre = 17 * 60; // 17:00
    if (minutosDesdeMedianoche < apertura || minutosDesdeMedianoche > cierre) {
      return {
        valido: false,
        mensaje: `En Sede Miraflores el horario de atención los Sábados es de 09:00 a 17:00 hrs. Tu hora seleccionada (${horaStr} hrs) está fuera de turno.`
      };
    }
  }

  return { valido: true };
}


export function calcularPeriodo24Horas(
  fechaRecojo: string,
  horaRecojo: string,
  fechaDevolucion: string,
  horaDevolucion: string
): CalculoTarifaPeriodo {
  if (!fechaRecojo || !horaRecojo || !fechaDevolucion || !horaDevolucion) {
    return {
      horasTotales: 0,
      ciclosCompletos24h: 0,
      horasExcedentes: 0,
      minutosExcedentes: 0,
      diasCobrados: 0,
      aplicaDiaAdicionalPorExceso: false,
      esPeriodoValido: false,
      mensajeDetalle: 'Ingresa las fechas y horas de recojo y devolución.'
    };
  }

  const dtInicio = new Date(`${fechaRecojo}T${horaRecojo}:00`);
  const dtFin = new Date(`${fechaDevolucion}T${horaDevolucion}:00`);

  const diffMs = dtFin.getTime() - dtInicio.getTime();
  if (diffMs <= 0) {
    return {
      horasTotales: 0,
      ciclosCompletos24h: 0,
      horasExcedentes: 0,
      minutosExcedentes: 0,
      diasCobrados: 0,
      aplicaDiaAdicionalPorExceso: false,
      esPeriodoValido: false,
      mensajeDetalle: 'La fecha y hora de devolución debe ser posterior a la de recojo.'
    };
  }

  const totalMinutos = Math.floor(diffMs / (1000 * 60));
  const totalHorasExactas = totalMinutos / 60;
  const ciclos = Math.floor(totalHorasExactas / 24);
  const minutosExcedentes = totalMinutos % (24 * 60);
  const horasExcedentes = Math.floor(minutosExcedentes / 60);
  const minsSobrantes = minutosExcedentes % 60;

  let diasCobrados = 1;
  let aplicaDiaAdicional = false;

  if (ciclos === 0) {

    diasCobrados = 1;
    aplicaDiaAdicional = false;
  } else {

    if (minutosExcedentes >= 60) {

      diasCobrados = ciclos + 1;
      aplicaDiaAdicional = true;
    } else {
      diasCobrados = ciclos;
      aplicaDiaAdicional = false;
    }
  }

  let mensaje = '';
  if (ciclos === 0) {
    mensaje = `Alquiler de ${totalHorasExactas.toFixed(1)} hrs: Corresponde a 1 ciclo base de 24 horas.`;
  } else if (aplicaDiaAdicional) {
    mensaje = `Exceso de ${horasExcedentes}h ${minsSobrantes}m sobre ciclo de 24h (supera 1 hora): Se cobra +1 día adicional automático (${diasCobrados} días en total).`;
  } else {
    mensaje = `${ciclos} ciclo(s) de 24 horas exactos (${diasCobrados} días facturados).`;
  }

  return {
    horasTotales: Number(totalHorasExactas.toFixed(2)),
    ciclosCompletos24h: ciclos,
    horasExcedentes: horasExcedentes,
    minutosExcedentes: minutosExcedentes,
    diasCobrados: Math.max(1, diasCobrados),
    aplicaDiaAdicionalPorExceso: aplicaDiaAdicional,
    esPeriodoValido: true,
    mensajeDetalle: mensaje
  };
}

import { NativeDateAdapter } from '@angular/material/core';
import { Injectable } from '@angular/core';

@Injectable()
export class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === 'input') {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return super.format(date, displayFormat);
  }
}

export const CUSTOM_DATE_FORMATS = {
  parse: {
    dateInput: { month: 'short', year: 'numeric', day: 'numeric' },
  },
  display: {
    dateInput: 'input',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};


export function crearFiltroFechasSede(
  sedeGetter: () => string,
  minDateGetter?: () => Date | null
): (d: Date | null) => boolean {
  return (d: Date | null): boolean => {
    if (!d) return true;
    const sede = typeof sedeGetter === 'function' ? sedeGetter() : sedeGetter;
    if (sede === 'MIRAFLORES' && d.getDay() === 0) {
      return false;
    }
    if (minDateGetter) {
      const minDate = typeof minDateGetter === 'function' ? minDateGetter() : minDateGetter;
      if (minDate) {
        const dClean = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const minClean = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime();
        if (dClean < minClean) {
          return false;
        }
      }
    }
    return true;
  };
}


export function obtenerHoyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calcularMinFechaRecojo(sede: string): string {
  const hoyStr = obtenerHoyISO();
  const validasHoy = obtenerHorasValidasSede(sede, hoyStr);
  if (validasHoy.length === 0) {
    return obtenerSiguienteFechaDisponible(sede, hoyStr) || hoyStr;
  }
  return hoyStr;
}

export function calcularMinFechaDevolucion(sedeDevolucion: string, fechaRecojo?: string): string {
  const fRecojo = fechaRecojo || obtenerHoyISO();
  const [y, m, d] = fRecojo.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  if (sedeDevolucion === 'MIRAFLORES' && dt.getDay() === 0) {
    dt.setDate(dt.getDate() + 1);
  }
  return formatearFechaISO(dt);
}

export function parsearFechaISO(val?: string | null): Date | null {
  if (!val) return null;
  const parts = val.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function formatearFechaISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function esFechaDomingo(fechaISO?: string | null): boolean {
  if (!fechaISO) return false;
  const dt = parsearFechaISO(fechaISO);
  return dt ? dt.getDay() === 0 : false;
}


