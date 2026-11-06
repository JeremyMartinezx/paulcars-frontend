import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Alquiler, MotivoRechazo, RechazoReservaRequest } from '../../../core/models/alquiler.model';
import { MOTIVOS_RECHAZO, formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';

export interface RechazoReservaData {
  alquiler: Alquiler;
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
  readonly motivos = MOTIVOS_RECHAZO;
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
