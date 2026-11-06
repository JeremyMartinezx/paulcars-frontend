import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  titulo: string;
  subtitulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  tipo?: 'finalizar' | 'cancelar' | 'eliminar' | 'advertencia';
  icono?: string;
  colorBoton?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

  readonly tipoDetectado = computed(() => {
    if (this.data.tipo) return this.data.tipo;
    const t = (this.data.titulo || '').toLowerCase();
    if (t.includes('finalizar')) return 'finalizar';
    if (t.includes('cancelar')) return 'cancelar';
    if (t.includes('eliminar')) return 'eliminar';
    return 'advertencia';
  });

  readonly icono = computed(() => {
    if (this.data.icono) return this.data.icono;
    const t = this.tipoDetectado();
    const titulo = (this.data.titulo || '').toLowerCase();
    const mensaje = (this.data.mensaje || '').toLowerCase();

    if (titulo.includes('usuario') || mensaje.includes('usuario') || titulo.includes('cliente') || mensaje.includes('cliente')) {
      if (t === 'eliminar') return 'person_remove';
      if (titulo.includes('desactivar') || titulo.includes('bloquear')) return 'person_off';
      if (titulo.includes('activar')) return 'how_to_reg';
      return 'manage_accounts';
    }

    if (t === 'eliminar') return 'delete';
    if (t === 'cancelar') return 'cancel';
    if (t === 'finalizar') return 'check_circle';
    if (titulo.includes('desactivar') || titulo.includes('bloquear')) return 'car_off';
    if (titulo.includes('activar')) return 'car_on';
    return 'directions_car';
  });

  cancelar(): void {
    this.dialogRef.close(false);
  }

  confirmar(): void {
    this.dialogRef.close(true);
  }
}
