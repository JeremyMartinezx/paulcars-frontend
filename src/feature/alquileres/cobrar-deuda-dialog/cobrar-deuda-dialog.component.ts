import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { environment } from '../../../environments/environment';
import { Alquiler } from '../../../core/models/alquiler.model';
import { DanosAlquiler } from '../../../core/models/dano.model';
import { MetodoPagoCatalogo } from '../../../core/models/pago.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';

export interface CobrarDeudaDialogData {
  alquiler: Alquiler;
}

// Cobro de la deuda que quedó cuando los cargos (daños, combustible, retraso) superaron la garantía.
@Component({
  selector: 'app-cobrar-deuda-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './cobrar-deuda-dialog.component.html',
  styleUrl: './cobrar-deuda-dialog.component.css'
})
export class CobrarDeudaDialogComponent {
  readonly data: CobrarDeudaDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CobrarDeudaDialogComponent, boolean>);
  private readonly alquilerService = inject(AlquilerService);
  private readonly http = inject(HttpClient);

  readonly alquiler = this.data.alquiler;
  readonly codigo = formatearCodigoAlquiler(this.alquiler.idAlquiler);

  readonly info = signal<DanosAlquiler | null>(null);
  readonly metodos = signal<MetodoPagoCatalogo[]>([]);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  idMetodo: number | null = null;
  readonly montoTexto = signal('');
  readonly recibidoTexto = signal('');
  numeroOperacion = '';

  readonly pendiente = computed(() => this.info()?.deudaPendiente ?? 0);
  readonly monto = computed(() => {
    const t = this.montoTexto().trim();
    return t === '' ? this.pendiente() : Number(t);
  });
  readonly montoValido = computed(() => Number.isFinite(this.monto()) && this.monto() > 0 && this.monto() <= this.pendiente() + 0.001);

  get esEfectivo(): boolean {
    return (this.metodos().find((m) => m.idMetodoPago === this.idMetodo)?.nombreMetodo ?? '').toUpperCase().includes('EFECTIVO');
  }

  readonly vuelto = computed(() => {
    const r = Number(this.recibidoTexto());
    return Number.isFinite(r) && r > this.monto() ? r - this.monto() : 0;
  });

  constructor() {
    this.alquilerService.danos(this.alquiler.idAlquiler!).subscribe({
      next: (d) => {
        this.info.set(d);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo consultar la deuda de este alquiler.');
      }
    });
    this.http.get<MetodoPagoCatalogo[]>(`${environment.apiUrl}/catalogos/metodos-pago`).subscribe({
      next: (lista) => {
        this.metodos.set(lista);
        this.idMetodo = lista.find((m) => m.nombreMetodo.toUpperCase().includes('EFECTIVO'))?.idMetodoPago ?? lista[0]?.idMetodoPago ?? null;
      }
    });
  }

  nombreMetodo(m: MetodoPagoCatalogo): string {
    const t = m.nombreMetodo.toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  get puedeCobrar(): boolean {
    if (this.enviando() || !this.montoValido() || this.idMetodo === null) return false;
    if (this.esEfectivo) {
      const r = Number(this.recibidoTexto());
      return this.recibidoTexto().trim() === '' || (Number.isFinite(r) && r >= this.monto());
    }
    return true;
  }

  confirmar(): void {
    if (!this.puedeCobrar) return;
    this.error.set(null);
    this.enviando.set(true);
    const recibido = this.recibidoTexto().trim() === '' ? null : Number(this.recibidoTexto());
    this.alquilerService
      .cobrarDeuda(this.alquiler.idAlquiler!, {
        idMetodoPago: this.idMetodo!,
        monto: this.monto(),
        montoRecibido: this.esEfectivo ? recibido : null,
        numeroOperacion: this.esEfectivo ? null : this.numeroOperacion.trim() || null
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.enviando.set(false);
          this.error.set(err?.error?.message || 'No se pudo registrar el pago de la deuda.');
        }
      });
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }
}
