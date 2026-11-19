import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Alquiler, EntregaRequest } from '../../../core/models/alquiler.model';
import { DanoRequest } from '../../../core/models/dano.model';
import { InspeccionDanosComponent } from '../../../shared/components/inspeccion-danos/inspeccion-danos.component';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { KM_MAXIMO_SALTO_ENTREGA, recojoPactado } from '../../../core/utils/entrega.util';
import { NIVELES_COMBUSTIBLE } from '../../../core/utils/combustible.util';
import { formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';

export interface EntregaLlavesDialogData {
  alquiler: Alquiler;
}

// Lo que se declara conforme al entregar el vehículo (una sola confirmación, no seis casillas)
export const ITEMS_CHECKLIST_ENTREGA = [
  'Tarjeta de propiedad y SOAT vigentes',
  'Llanta de repuesto y gata',
  'Triángulo de seguridad y extintor',
  'Interior limpio y sin daños',
  'Carrocería revisada (rayones o abolladuras)',
  'Luces y accesorios en funcionamiento'
];

@Component({
  selector: 'app-entrega-llaves-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, InspeccionDanosComponent],
  templateUrl: './entrega-llaves-dialog.component.html',
  styleUrl: './entrega-llaves-dialog.component.css'
})
export class EntregaLlavesDialogComponent {
  readonly data: EntregaLlavesDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EntregaLlavesDialogComponent, boolean>);
  private readonly alquilerService = inject(AlquilerService);

  readonly alquiler = this.data.alquiler;
  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;
  readonly items = ITEMS_CHECKLIST_ENTREGA;

  readonly niveles = NIVELES_COMBUSTIBLE;

  // Reloj en vivo: la hora de entrega es la del momento en que se confirma, no la de cuando se abrió la pantalla
  private readonly destroyRef = inject(DestroyRef);
  readonly ahora = signal(new Date());
  private readonly reloj = setInterval(() => this.ahora.set(new Date()), 1000);
  private readonly limpiarReloj = this.destroyRef.onDestroy(() => clearInterval(this.reloj));

  // Odómetro de la unidad: el último kilometraje registrado es el punto de partida y no se puede bajar de él
  readonly kmUnidad: number = this.alquiler.vehiculoUnidad?.kilometraje ?? 0;
  readonly kilometraje = signal<number | null>(this.kmUnidad);
  // Nivel de combustible con el que sale el vehículo (por defecto lleno, como se prepara en patio)
  readonly combustible = signal<string>('LLENO');

  // Estado del formulario: kilometraje, combustible y dos confirmaciones
  // Estado inicial del vehículo: daños que ya tiene al entregarlo (no se cobran al cliente)
  readonly danos = signal<DanoRequest[]>([]);
  readonly editandoDano = signal(false);
  readonly documentosVerificados = signal(false);
  readonly vehiculoConforme = signal(false);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly entregado = signal(false);

  // Mensaje de error del kilometraje (vacío si es válido)
  readonly kmError = computed(() => {
    const km = this.kilometraje();
    if (km === null || !Number.isFinite(km) || km < 0) return 'Ingrese la lectura del odómetro.';
    if (km < this.kmUnidad) return `No puede ser menor al último registrado (${this.kmUnidad.toLocaleString('es-PE')} km).`;
    if (km - this.kmUnidad > KM_MAXIMO_SALTO_ENTREGA) {
      return `Supera en más de ${KM_MAXIMO_SALTO_ENTREGA} km al último registrado. Verifique la lectura.`;
    }
    return '';
  });

  // Aviso cuando a la unidad le falta poco para su mantenimiento
  readonly avisoMantenimiento = computed(() => {
    const r = this.alquiler.vehiculoUnidad?.kmRestantesMantenimiento;
    return r !== undefined && r !== null && r > 0 && r <= 1000
      ? `A esta unidad le faltan ${r.toLocaleString('es-PE')} km para su mantenimiento.`
      : '';
  });

  readonly completo = computed(() => this.documentosVerificados() && this.vehiculoConforme() && !this.kmError() && !this.editandoDano());

  readonly faltantes = computed(() => {
    const f: string[] = [];
    if (this.kmError()) f.push('kilometraje');
    if (!this.documentosVerificados()) f.push('verificar DNI y licencia');
    if (this.editandoDano()) f.push('agregar o cancelar el daño que está llenando');
    if (!this.vehiculoConforme()) f.push('confirmar el vehículo');
    return f;
  });

  // La hora de entrega no se digita. Si el cliente llega antes de la hora pactada, sale a la hora real y la devolución
  // se adelanta los mismos minutos; si llega a la hora o con retraso, sale a la hora pactada y la devolución no se mueve.
  readonly horas = computed(() => {
    const a = this.alquiler;
    const ahora = new Date(this.ahora().getTime());
    ahora.setMilliseconds(0);
    const pactada = recojoPactado(a);
    const devolucionPactada = a.fechaFinEstimada && a.horaDevolucion
      ? new Date(`${a.fechaFinEstimada}T${a.horaDevolucion.slice(0, 5)}:00`)
      : null;
    // Antes de la hora pactada: sale a la hora real (en vivo) y la devolución se adelanta esos minutos
    const anticipada = !!pactada && ahora < pactada;
    const entrega = ahora; // la hora real de entrega es la del momento en que se confirma
    let devolucion = devolucionPactada && !isNaN(devolucionPactada.getTime()) ? devolucionPactada : null;
    if (anticipada && devolucion && pactada) {
      const minutos = Math.floor((pactada.getTime() - ahora.getTime()) / 60000);
      devolucion = new Date(devolucion.getTime() - minutos * 60000);
    }
    const dos = (n: number) => String(n).padStart(2, '0');
    const formato = (d: Date, segundos: boolean) =>
      `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} · ${dos(d.getHours())}:${dos(d.getMinutes())}${segundos ? ':' + dos(d.getSeconds()) : ''} hrs`;
    return { entrega: formato(entrega, true), devolucion: devolucion ? formato(devolucion, false) : '—' };
  });

  clienteNombre(): string {
    const c = this.alquiler.cliente;
    return c ? `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() : 'Cliente';
  }

  correoCliente(): string {
    return this.alquiler.cliente?.email ?? '';
  }

  nombreVehiculo(): string {
    const v: any = this.alquiler.vehiculo;
    const marca = v?.modelo?.marca?.nombreMarca || v?.marca?.nombreMarca || '';
    const modelo = v?.modelo?.modelo || v?.nombreModelo || '';
    return `${marca} ${modelo}`.trim() || 'Vehículo';
  }

  placa(): string {
    return (this.alquiler.placa || this.alquiler.vehiculoUnidad?.placa || '').trim();
  }

  onKm(valor: string): void {
    const n = valor === '' ? null : Number(valor);
    this.kilometraje.set(n === null || Number.isNaN(n) ? null : Math.floor(n));
  }

  confirmar(): void {
    if (!this.completo() || this.enviando()) return;
    this.error.set(null);
    this.enviando.set(true);

    const acta: EntregaRequest = {
      documentosVerificados: this.documentosVerificados(),
      kilometraje: this.kilometraje() as number,
      combustible: this.combustible(),
      // La confirmación de conformidad cubre todos los puntos del acta
      checklist: [...this.items],
      observaciones: null,
      danos: this.danos()
    };

    this.alquilerService.entregarLlaves(this.alquiler.idAlquiler!, acta).subscribe({
      next: () => {
        this.enviando.set(false);
        this.entregado.set(true);
        // Sin pantalla intermedia: se cierra y la lista muestra el aviso de confirmación
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(err?.error?.message || 'No se pudo registrar la entrega del vehículo.');
      }
    });
  }

  cerrar(): void {
    this.dialogRef.close(this.entregado());
  }
}
