import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Alquiler } from '../../../core/models/alquiler.model';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import { categoriaVehiculo, formatearCodigoAlquiler, garantiaHold } from '../../../core/utils/reglas-negocio.util';

export interface AprobarReservaData {
  alquiler: Alquiler;
  // Todos los alquileres del cliente: sirven para calcular su récord
  historialCliente: Alquiler[];
}

// Lo que devuelve el modal al cerrarse
export type AprobarReservaResultado = 'APROBAR' | 'RECHAZAR' | undefined;

@Component({
  selector: 'app-aprobar-reserva-dialog',
  standalone: true,
  imports: [DecimalPipe, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './aprobar-reserva-dialog.component.html',
  styleUrl: './aprobar-reserva-dialog.component.css'
})
export class AprobarReservaDialogComponent {
  readonly data: AprobarReservaData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AprobarReservaDialogComponent, AprobarReservaResultado>);

  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;
  readonly alquiler = this.data.alquiler;
  readonly cliente = this.data.alquiler.cliente;
  readonly vehiculo = this.data.alquiler.vehiculo;

  readonly imagen = obtenerImagenVehiculo(this.vehiculo);
  readonly categoria = categoriaVehiculo(this.vehiculo);
  readonly garantia = garantiaHold(this.vehiculo);

  readonly dias = this.alquiler.dias && this.alquiler.dias > 0
    ? this.alquiler.dias
    : Math.max(1, Math.round(
        (new Date(this.alquiler.fechaFinEstimada).getTime() - new Date(this.alquiler.fechaInicio).getTime()) / 86_400_000
      ));

  // Los alquileres antiguos tienen precio 0: se recalcula con la tarifa del auto
  readonly tarifaBase = this.alquiler.precioBase && this.alquiler.precioBase > 0
    ? this.alquiler.precioBase
    : this.dias * (this.vehiculo?.precioDia ?? 0);
  readonly montoExtras = this.alquiler.montoExtras ?? 0;
  readonly total = this.alquiler.precioTotal && this.alquiler.precioTotal > 0
    ? this.alquiler.precioTotal
    : this.tarifaBase + this.montoExtras;

  readonly extras: string[] = (this.alquiler.serviciosExtras || '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.toLowerCase() !== 'ninguno');

  // Récord del conductor: Observado si está bloqueado, Frecuente con 2+ alquileres cerrados, si no Nuevo
  readonly record = this.calcularRecord();

  readonly bloqueado = false;
  readonly sinLicencia = !this.cliente?.licenciaConducir;

  private calcularRecord(): { texto: string; clase: string } {
    if (this.bloqueado) {
      return { texto: 'LISTA NEGRA', clase: 'observado' };
    }
    const cerrados = this.data.historialCliente.filter((a) =>
      a.idAlquiler !== this.alquiler.idAlquiler &&
      ['FINALIZADO', 'CERRADO_CON_DEUDA'].includes(a.estado?.nombreEstado ?? '')
    ).length;
    if (cerrados >= 2) return { texto: 'CONDUCTOR FRECUENTE', clase: 'frecuente' };
    return { texto: 'CLIENTE NUEVO', clase: 'nuevo' };
  }

  formatearSede(sede?: string): string {
    return (sede || '').toUpperCase() === 'AEROPUERTO' ? 'Aeropuerto Jorge Chávez' : 'Sede Miraflores';
  }

  aprobar(): void {
    this.dialogRef.close('APROBAR');
  }

  rechazar(): void {
    this.dialogRef.close('RECHAZAR');
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
