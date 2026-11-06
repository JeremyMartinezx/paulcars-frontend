import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Alquiler } from '../../../core/models/alquiler.model';
import { LiquidacionResponse } from '../../../core/models/liquidacion.model';
import { PagoService } from '../../../core/service/pago.service';
import {
  LiquidacionAlquiler,
  formatearCodigoAlquiler,
  nombreVehiculoAlquiler,
  obtenerLiquidacionAlquiler
} from '../../../core/utils/reglas-negocio.util';

export interface ActaDialogData {
  acta?: LiquidacionResponse;
  alquiler?: Alquiler;
  pagado?: boolean;
}

@Component({
  selector: 'app-acta-liquidacion-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './acta-liquidacion-dialog.component.html',
  styleUrl: './acta-liquidacion-dialog.component.css'
})
export class ActaLiquidacionDialogComponent {
  readonly data: ActaDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ActaLiquidacionDialogComponent>);
  private readonly pagoService = inject(PagoService);

  readonly alquiler: Alquiler;
  readonly liq: LiquidacionAlquiler;
  readonly est: string;
  readonly esPagado: boolean;
  readonly codigoAlquiler: string;
  readonly nombreVehiculo: string;

  constructor() {
    const act = this.data.acta;
    const alq = this.data.alquiler;

    if (alq) {
      this.alquiler = alq;
    } else if (act) {
      this.alquiler = {
        idAlquiler: act.idAlquiler,
        fechaInicio: act.fechaCheckout ? act.fechaCheckout.slice(0, 10) : '',
        fechaFinEstimada: act.fechaCheckout ? act.fechaCheckout.slice(0, 10) : '',
        fechaFinReal: act.fechaCheckout || '',
        fechaCheckout: act.fechaCheckout || '',
        garantiaRetenida: act.garantiaRetenida,
        garantiaLiberada: act.garantiaLiberada,
        estado: { idEstado: 5, nombreEstado: act.estadoAlquiler || 'FINALIZADO' },
        cliente: {
          idCliente: 1,
          nombres: act.cliente || 'Cliente Registrado',
          apellidos: '',
          numeroDocumento: act.documentoCliente || '',
        },
        vehiculo: {
          placa: act.placa || '',
          tipo: { idTipo: 1, nombreTipo: act.categoria || 'SUV' },
          modelo: {
            idModelo: 1,
            modelo: act.vehiculo || '',
            marca: { idMarca: 1, nombreMarca: '' }
          }
        }
      } as unknown as Alquiler;
    } else {
      this.alquiler = {} as unknown as Alquiler;
    }

    this.liq = obtenerLiquidacionAlquiler(this.alquiler, act);
    this.est = (this.alquiler.estado?.nombreEstado || act?.estadoAlquiler || 'FINALIZADO').toUpperCase();
    this.codigoAlquiler = formatearCodigoAlquiler(this.alquiler.idAlquiler || act?.idAlquiler);
    this.nombreVehiculo = nombreVehiculoAlquiler(this.alquiler, act);

    const idAlq = this.alquiler.idAlquiler || act?.idAlquiler;
    const tienePagoServicio = idAlq
      ? this.pagoService.pagos().some((p) => p.alquiler?.idAlquiler === idAlq && p.tipoPago !== 'LIQUIDACION')
      : false;

    this.esPagado =
      this.data.pagado === true ||
      this.est === 'PAGADO' ||
      this.est === 'CONFIRMADO' ||
      this.est === 'ACTIVO' ||
      this.est === 'EN_CURSO' ||
      this.est === 'EN CURSO' ||
      this.est === 'FINALIZADO' ||
      tienePagoServicio;
  }

  get nombreCliente(): string {
    if (this.alquiler.cliente?.nombres) {
      return `${this.alquiler.cliente.nombres} ${this.alquiler.cliente.apellidos || ''}`.trim();
    }
    return this.data.acta?.cliente || 'Cliente Registrado';
  }

  get dniCliente(): string {
    return (
      this.alquiler.cliente?.numeroDocumento ||
      this.data.acta?.documentoCliente ||
      ''
    );
  }

  get placaVehiculo(): string {
    if (this.est === 'PENDIENTE') return '';
    return (
      this.alquiler.vehiculoUnidad?.placa ||
      this.alquiler.vehiculo?.placa ||
      this.data.acta?.placa ||
      ''
    ).trim();
  }

  get iconoDocumento(): string {
    if (this.est === 'PENDIENTE') return 'description';
    if (!this.esPagado && (this.est === 'RESERVADO' || this.est === 'APROBADO')) return 'event_note';
    return 'receipt_long';
  }

  get tituloDocumento(): string {
    if (this.est === 'FINALIZADO') {
      return 'Comprobante Oficial de Liquidación';
    }
    if (this.est === 'ACTIVO' || this.est === 'EN_CURSO' || this.est === 'EN CURSO') {
      return 'Comprobante de Alquiler en Curso';
    }
    if (this.est === 'RESERVADO' || this.est === 'APROBADO' || this.est === 'PAGADO' || this.est === 'CONFIRMADO') {
      return this.esPagado ? 'Comprobante de Pago de Reserva' : 'Orden de Reserva (Por Pagar)';
    }
    return 'Resumen de Solicitud de Reserva';
  }

  get etiquetaNumeroStrip(): string {
    if (this.est === 'PENDIENTE') return 'N° SOLICITUD';
    if (!this.esPagado) return 'N° RESERVA';
    return 'N° COMPROBANTE';
  }

  get etiquetaEstadoStrip(): string {
    if (this.est === 'PENDIENTE') return 'PENDIENTE';
    if (this.est === 'ACTIVO' || this.est === 'EN_CURSO' || this.est === 'EN CURSO') return 'EN RUTA';
    if (this.est === 'FINALIZADO') return 'FINALIZADO';
    if (this.est === 'RESERVADO' || this.est === 'APROBADO' || this.est === 'PAGADO' || this.est === 'CONFIRMADO') {
      return this.esPagado ? 'RESERVADO • PAGADO' : 'RESERVADO • POR PAGAR';
    }
    return this.est;
  }

  get condicionPagoStrip(): string {
    if (this.est === 'PENDIENTE') return 'En evaluación • Sin cobro';
    if (this.est === 'FINALIZADO') return 'Pagado y liquidado';
    if (this.est === 'ACTIVO' || this.est === 'EN_CURSO' || this.est === 'EN CURSO') return 'Pago acreditado';
    if (this.esPagado) return 'Pago anticipado acreditado';
    return 'Pendiente (Online o en Sede)';
  }

  get etiquetaTotal(): string {
    if (this.est === 'FINALIZADO') return 'Total Liquidado';
    if (this.esPagado) return 'Total Pagado';
    return 'Total Estimado a Pagar';
  }

  get subtituloTotal(): string {
    if (this.est === 'FINALIZADO') return 'Monto total liquidado de la operación';
    if (this.esPagado) return 'Importe pagado y acreditado en el sistema';
    if (this.est === 'PENDIENTE') return 'Cotización referencial sujeta a aprobación (no es comprobante fiscal)';
    return 'Importe pendiente de pago online o en counter al recoger el vehículo';
  }

  get diasTexto(): string {
    const d = this.liq.dias;
    return d === 1 ? '1 día' : `${d} días`;
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
