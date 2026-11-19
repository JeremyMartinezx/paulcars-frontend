import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Alquiler } from '../../../core/models/alquiler.model';
import { Dano, DanoRequest } from '../../../core/models/dano.model';
import { InspeccionDanosComponent } from '../../../shared/components/inspeccion-danos/inspeccion-danos.component';
import { CargosPrevios, CheckoutRequest, LiquidacionResponse } from '../../../core/models/liquidacion.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';
import { KM_MARGEN_MANTENIMIENTO, KM_MAXIMO_POR_DIA } from '../../../core/utils/entrega.util';
import { NIVELES_COMBUSTIBLE, etiquetaCombustible, ordenCombustible } from '../../../core/utils/combustible.util';

export interface CheckoutDialogData {
  alquiler: Alquiler;
}

@Component({
  selector: 'app-checkout-inspeccion-dialog',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    InspeccionDanosComponent
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

  // Daños: los que el vehículo ya tenía al entregarlo (referencia) y los nuevos que se encuentran al recibirlo
  readonly danosEntrega = signal<Dano[]>([]);
  readonly danosNuevos = signal<DanoRequest[]>([]);
  readonly editandoDano = signal(false);
  private readonly cargaDanosEntrega = this.alquilerService
    .danos(this.data.alquiler.idAlquiler!)
    .subscribe({ next: (d) => this.danosEntrega.set(d.entrega ?? []), error: () => this.danosEntrega.set([]) });
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

  // ───── Kilometraje y combustible al recibir ─────
  readonly niveles = NIVELES_COMBUSTIBLE;
  readonly etiquetaCombustible = etiquetaCombustible;

  // Con cuánto salió el vehículo: el kilometraje de recepción no puede ser menor
  readonly kmEntrega: number = this.alquiler.kmEntrega ?? this.alquiler.vehiculoUnidad?.kilometraje ?? 0;
  readonly combustibleEntrega: string = this.alquiler.combustibleEntrega || 'LLENO';
  kilometraje: number | null = this.kmEntrega;
  // El asesor debe elegir el nivel que marca el tablero (no se propone uno para que no se pase por alto)
  combustible: string | null = null;

  get diasContrato(): number {
    return Math.max(1, this.alquiler.dias ?? 1);
  }

  get kmTope(): number {
    return this.diasContrato * KM_MAXIMO_POR_DIA;
  }

  get kmError(): string {
    const km = this.kilometraje;
    if (km === null || !Number.isFinite(km) || km < 0) return 'Ingrese la lectura del odómetro.';
    if (km < this.kmEntrega) return `No puede ser menor al de la entrega (${this.kmEntrega.toLocaleString('es-PE')} km).`;
    if (km - this.kmEntrega > this.kmTope) {
      return `Implica más de ${this.kmTope.toLocaleString('es-PE')} km en ${this.diasContrato} ${this.diasContrato === 1 ? 'día' : 'días'}. Verifique la lectura.`;
    }
    return '';
  }

  get kmRecorridos(): number {
    return !this.kmError && this.kilometraje !== null ? this.kilometraje - this.kmEntrega : 0;
  }

  // Si regresa con menos combustible del que salió (solo informativo)
  get menosCombustible(): boolean {
    return !!this.combustible && ordenCombustible(this.combustible) < ordenCombustible(this.combustibleEntrega);
  }

  // Si con este kilometraje la unidad llega a su mantenimiento, saldrá de servicio
  get irAMantenimiento(): boolean {
    const proximo = this.alquiler.vehiculoUnidad?.kmProximoMantenimiento;
    return proximo !== undefined && proximo !== null && !this.kmError && this.kilometraje !== null
      && proximo - this.kilometraje <= KM_MARGEN_MANTENIMIENTO;
  }

  get kmRestantesMantenimiento(): number {
    return Math.max(0, this.kmProximoMantenimiento - (this.kilometraje ?? 0));
  }

  get kmProximoMantenimiento(): number {
    return this.alquiler.vehiculoUnidad?.kmProximoMantenimiento ?? 0;
  }

  // ───── Cargos: combustible faltante y retraso (los calcula el servidor) ─────
  readonly cargos = signal<CargosPrevios | null>(null);
  private ultimaConsulta = 0;

  elegirCombustible(valor: string): void {
    this.combustible = valor;
    this.actualizarCargos();
  }

  private actualizarCargos(): void {
    if (!this.combustible) return;
    this.ultimaConsulta = Date.now();
    this.alquilerService.cargosPrevios(this.alquiler.idAlquiler!, this.combustible, this.momentoIso).subscribe({
      next: (c) => this.cargos.set(c),
      error: () => this.cargos.set(null)
    });
  }

  get totalCargos(): number {
    const c = this.cargos();
    return (c?.cargoCombustible ?? 0) + (c?.cargoRetraso ?? 0);
  }

  get saldoPorCobrar(): number {
    return Math.max(0, this.totalCargos - (this.cargos()?.garantia ?? 0));
  }

  get hayCargos(): boolean {
    return this.totalCargos > 0;
  }

  onKm(valor: string): void {
    const n = valor === '' ? null : Number(valor);
    this.kilometraje = n === null || Number.isNaN(n) ? null : Math.floor(n);
  }

  // La hora de devolución queda fija en el momento en que se abre esta pantalla (no corre ni se digita)
  readonly ahora = signal(new Date());

  private static dos(n: number): string {
    return String(n).padStart(2, '0');
  }

  get relojTexto(): string {
    const d = this.ahora();
    const dos = CheckoutInspeccionDialogComponent.dos;
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} · ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())} hrs`;
  }

  // Hora local sin zona (AAAA-MM-DDTHH:mm:ss): es la que se envía al servidor
  get momentoIso(): string {
    const d = this.ahora();
    const dos = CheckoutInspeccionDialogComponent.dos;
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
  }

  enviando = false;
  error: string | null = null;

  // Hora de devolución pactada según el plan contratado
  devolucionPactada(): string {
    const a = this.alquiler;
    const f = a.fechaFinEstimada ? a.fechaFinEstimada.split('-').reverse().join('/') : '—';
    return `${f} ${a.horaDevolucion || ''}`.trim() + (a.horaDevolucion ? ' hrs' : '');
  }

  confirmar(): void {
    if (this.kmError) {
      this.error = this.kmError;
      return;
    }
    if (!this.combustible) {
      this.error = 'Seleccione el nivel de combustible con el que regresa el vehículo.';
      return;
    }
    if (this.editandoDano()) {
      this.error = 'Tiene un daño sin agregar: pulse «Agregar daño» para guardarlo o «Cancelar» para descartarlo.';
      return;
    }
    this.error = null;
    this.enviando = true;

    // Fecha local (no UTC) y hora real de devolución indicada por el asesor
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

    const request: CheckoutRequest = {
      fechaDevolucion: hoy,
      momentoRecepcion: this.momentoIso,
      garantiaRetenida: 0,
      kilometraje: this.kilometraje as number,
      combustible: this.combustible as string,
      danos: this.danosNuevos(),
      observaciones:
        (this.observaciones && this.observaciones.trim()) ||
        (this.danosNuevos().length > 0
          ? 'Se recibieron las llaves y el vehículo; se registraron daños nuevos pendientes de evaluación.'
          : 'Se recibieron las llaves y el vehículo en su totalidad, sin daños nuevos.')
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
