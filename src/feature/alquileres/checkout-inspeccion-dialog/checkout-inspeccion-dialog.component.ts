import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Alquiler } from '../../../core/models/alquiler.model';
import { CheckoutRequest, LiquidacionResponse } from '../../../core/models/liquidacion.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';

export interface CheckoutDialogData {
  alquiler: Alquiler;
}

@Component({
  selector: 'app-checkout-inspeccion-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './checkout-inspeccion-dialog.component.html',
  styleUrl: './checkout-inspeccion-dialog.component.css'
})
export class CheckoutInspeccionDialogComponent {
  readonly data: CheckoutDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CheckoutInspeccionDialogComponent, LiquidacionResponse>);
  private readonly alquilerService = inject(AlquilerService);

  readonly alquiler = this.data.alquiler;
  readonly vehiculo = this.data.alquiler.vehiculo;
  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;
  nombreVehiculo(): string {
    const v = this.alquiler.vehiculo;
    const marca = v?.modelo?.marca?.nombreMarca || '';
    const modelo = v?.modelo?.modelo || '';
    const placa = (v?.placa || this.alquiler.vehiculoUnidad?.placa || this.alquiler.placa || '').trim();
    const base = `${marca} ${modelo}`.trim() || 'Vehículo';
    return placa ? `${base} (${placa})` : base;
  }

  modeloVehiculo(): string {
    const v = this.alquiler.vehiculo;
    const marca = v?.modelo?.marca?.nombreMarca || '';
    const modelo = v?.modelo?.modelo || '';
    return `${marca} ${modelo}`.trim() || 'Vehículo';
  }

  placaVehiculo(): string {
    return (this.alquiler.placa || this.alquiler.vehiculoUnidad?.placa || this.alquiler.vehiculo?.placa || '').trim();
  }

  clienteNombre(): string {
    const c = this.alquiler.cliente;
    return c ? `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() : 'Cliente';
  }


  observaciones: string = '';
  enviando = false;
  error: string | null = null;

  confirmar(): void {
    this.error = null;
    this.enviando = true;

    const hoy = new Date().toISOString().slice(0, 10);
    const hora = new Date().toTimeString().slice(0, 5);

    const request: CheckoutRequest = {
      fechaDevolucion: hoy,
      horaDevolucion: hora,
      garantiaRetenida: 0,
      observaciones:
        (this.observaciones && this.observaciones.trim()) ||
        'Se recibieron las llaves y el vehículo en su totalidad y en óptimas condiciones.'
    };

    this.alquilerService.checkout(this.alquiler.idAlquiler!, request).subscribe({
      next: (acta) => {
        this.enviando = false;
        this.dialogRef.close(acta);
      },
      error: (err) => {
        this.enviando = false;
        this.error = err?.error?.message || 'No se pudo registrar la recepción de las llaves.';
      }
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
