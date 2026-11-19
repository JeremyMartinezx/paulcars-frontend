import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { Alquiler } from '../../../core/models/alquiler.model';
import {
  Dano,
  DanosAlquiler,
  TasacionResultado,
  etiquetaGravedad,
  etiquetaTipoDano,
  etiquetaZona
} from '../../../core/models/dano.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';
import { resolverUrlImagen } from '../../../core/utils/imagen-url.util';

export interface EvaluarDanosDialogData {
  alquiler: Alquiler;
}

// El administrador evalúa los daños nuevos: fija el costo de reparación de cada uno y, si el cliente contrató el
// Seguro Todo Riesgo, cuánto cubre el seguro. El sistema reparte el costo y liquida la garantía.
@Component({
  selector: 'app-evaluar-danos-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './evaluar-danos-dialog.component.html',
  styleUrl: './evaluar-danos-dialog.component.css'
})
export class EvaluarDanosDialogComponent {
  readonly data: EvaluarDanosDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EvaluarDanosDialogComponent, boolean>);
  private readonly alquilerService = inject(AlquilerService);

  readonly alquiler = this.data.alquiler;
  readonly codigo = formatearCodigoAlquiler(this.alquiler.idAlquiler);
  readonly etiquetaZona = etiquetaZona;
  readonly etiquetaTipo = etiquetaTipoDano;
  readonly etiquetaGravedad = etiquetaGravedad;
  readonly foto = resolverUrlImagen;

  readonly info = signal<DanosAlquiler | null>(null);
  readonly danos = computed<Dano[]>(() => this.info()?.recepcion ?? []);
  readonly tieneSeguro = computed(() => !!this.info()?.tieneSeguro);

  // Costo de reparación por daño (texto, para poder dejarlo vacío mientras se escribe)
  readonly costos = signal<Record<number, string>>({});
  // Solo ante una exclusión del seguro (el seguro aplica solo, sin elegir nada)
  readonly seguroNoAplica = signal(false);
  observacion = '';
  readonly observacionTexto = signal('');

  readonly resultado = signal<TasacionResultado | null>(null);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  // Todos los daños tienen un costo válido (puede ser 0) y, si el seguro no aplica, se indicó el motivo
  readonly completo = computed(() => {
    const c = this.costos();
    const costosListos = this.danos().length > 0 && this.danos().every((d) => this.costoNumero(c[d.idDano]) !== null);
    const motivoListo = !this.seguroNoAplica() || this.observacionTexto().trim().length >= 5;
    return costosListos && motivoListo;
  });

  readonly falta = computed(() => {
    const c = this.costos();
    if (!(this.danos().length > 0 && this.danos().every((d) => this.costoNumero(c[d.idDano]) !== null))) return 'Ingrese el costo de cada daño';
    if (this.seguroNoAplica() && this.observacionTexto().trim().length < 5) return 'Indique el motivo de la exclusión';
    return '';
  });

  constructor() {
    this.alquilerService.danos(this.alquiler.idAlquiler!).subscribe({
      next: (d) => {
        this.info.set(d);
        this.cargando.set(false);
        if (d.estadoDanos !== 'PENDIENTE_EVALUACION') {
          this.error.set('Este alquiler no tiene daños pendientes de evaluación.');
        }
        this.recalcular();
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudieron cargar los daños de este alquiler.');
      }
    });
  }

  costoNumero(texto: string | undefined): number | null {
    if (texto === undefined || texto === null || texto.trim() === '') return null;
    const n = Number(texto);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  onCosto(idDano: number, valor: string): void {
    this.costos.update((c) => ({ ...c, [idDano]: valor }));
    this.programarRecalculo();
  }

  alternarExclusion(valor: boolean): void {
    this.seguroNoAplica.set(valor);
    this.programarRecalculo();
  }

  onObservacion(valor: string): void {
    this.observacion = valor;
    this.observacionTexto.set(valor);
  }

  private programarRecalculo(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.recalcular(), 250);
  }

  private peticion() {
    const costos = this.danos().map((d) => ({ idDano: d.idDano, costo: this.costoNumero(this.costos()[d.idDano]) ?? 0 }));
    return { costos, seguroNoAplica: this.tieneSeguro() && this.seguroNoAplica(), observacion: this.observacion.trim() || null };
  }

  private recalcular(): void {
    this.alquilerService.vistaPreviaTasacion(this.alquiler.idAlquiler!, this.peticion()).subscribe({
      next: (r) => this.resultado.set(r),
      error: () => this.resultado.set(null)
    });
  }

  confirmar(): void {
    if (!this.completo() || this.enviando()) return;
    this.error.set(null);
    this.enviando.set(true);
    this.alquilerService.tasarDanos(this.alquiler.idAlquiler!, this.peticion()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(err?.error?.message || 'No se pudo registrar la evaluación.');
      }
    });
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }
}
