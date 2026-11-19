import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Alquiler, MotivoRechazo, RechazoReservaRequest } from '../../../core/models/alquiler.model';
import { MOTIVOS_RECHAZO, formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';

export interface RechazoReservaData {
  alquiler: Alquiler;
  /** Si el cliente ya tuvo alquileres: solo entonces puede tener obligaciones pendientes. */
  tuvoAlquileres?: boolean;
}

@Component({
  selector: 'app-rechazo-reserva-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './rechazo-reserva-dialog.component.html',
  styleUrl: './rechazo-reserva-dialog.component.css'
})
export class RechazoReservaDialogComponent {
  readonly data: RechazoReservaData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RechazoReservaDialogComponent, RechazoReservaRequest>);

  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;
  // «Obligaciones pendientes de un alquiler anterior» no se ofrece a un cliente nuevo
  readonly motivos = MOTIVOS_RECHAZO.filter((m) => m.valor !== 'HISTORIAL_NEGATIVO' || this.data.tuvoAlquileres !== false);
  readonly motivoSeleccionado = signal<MotivoRechazo | null>(null);

  observaciones = '';
  intentoEnviar = false;

  seleccionar(valor: MotivoRechazo): void {
    this.motivoSeleccionado.set(valor);
  }

  confirmar(): void {
    this.intentoEnviar = true;
    const motivo = this.motivoSeleccionado();
    if (!motivo) return;
    this.dialogRef.close({
      motivo,
      observaciones: this.observaciones.trim() || undefined
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
