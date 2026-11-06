import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Alquiler } from '../../../core/models/alquiler.model';
import { PagoService } from '../../../core/service/pago.service';
import { RegistrarPagoRequest } from '../../../core/models/pago.model';
import { categoriaVehiculo, formatearCodigoAlquiler, garantiaHold } from '../../../core/utils/reglas-negocio.util';

export interface PagoDialogData {
  alquiler: Alquiler;
  // ALQUILER = cobro del contrato y entrega de llaves; DEUDA = pago de la deuda del check-out
  modo?: 'ALQUILER' | 'DEUDA';
}

export interface MetodoPagoItem {
  id: number;
  nombre: string;
  icono: string;
  tipo: 'efectivo' | 'pos' | 'yape' | 'transferencia';
}

@Component({
  selector: 'app-pago-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  templateUrl: './pago-dialog.component.html',
  styleUrl: './pago-dialog.component.css'
})
export class PagoDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<PagoDialogComponent>);
  private readonly pagoService = inject(PagoService);
  readonly data: PagoDialogData = inject(MAT_DIALOG_DATA);
  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;

  private readonly http = inject(HttpClient);

  // IDs alineados con la base de datos (8 EFECTIVO, 7 TARJETA, 9 YAPE, 11 TRANSFERENCIA)
  readonly metodosPago: MetodoPagoItem[] = [
    { id: 8, nombre: 'EFECTIVO', icono: 'payments', tipo: 'efectivo' },
    { id: 7, nombre: 'TARJETA DE CRÉDITO / DÉBITO (POS)', icono: 'credit_card', tipo: 'pos' },
    { id: 9, nombre: 'YAPE / PLIN (BILLETERA DIGITAL)', icono: 'smartphone', tipo: 'yape' },
    { id: 11, nombre: 'TRANSFERENCIA BANCARIA', icono: 'account_balance', tipo: 'transferencia' }
  ];

  readonly metodoSeleccionadoId = signal<number>(8);

  readonly metodoSeleccionado = computed(() => {
    const id = this.metodoSeleccionadoId();
    return this.metodosPago.find(m => m.id === id) || this.metodosPago[0];
  });

  readonly esDeuda = this.data.modo === 'DEUDA';

  cargando = false;
  cargandoSaldo = true;
  error: string | null = null;
  diasCalculados = 1;
  totalSugerido = 0;

  categoriaVehiculo = 'SEDAN';
  montoGarantiaAutomatica = 3500;

  readonly efectivoRecibido = signal<number>(0);
  readonly montoACobrar = signal<number>(0);

  readonly vueltoCalculado = computed(() => Math.max(0, this.efectivoRecibido() - this.montoACobrar()));
  readonly faltaEfectivo = computed(() => Math.max(0, this.montoACobrar() - this.efectivoRecibido()));

  form = this.fb.group({
    idMetodoPago: [8, [Validators.required]],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    montoRecibido: [0],
    ultimosDigitos: [''],
    numeroOperacion: [''],
    bancoOrigen: [''],
    garantiaConfirmada: [true]
  });

  
  nombreVehiculo(): string {
    const v = this.data.alquiler.vehiculo;
    const marca = v?.modelo?.marca?.nombreMarca || '';
    const modelo = v?.modelo?.modelo || '';
    const placa = v?.placa || this.data.alquiler.vehiculoUnidad?.placa || this.data.alquiler.placa || '';
    const base = `${marca} ${modelo}`.trim() || 'Vehículo';
    return placa ? `${base} (${placa})` : base;
  }

  ngOnInit(): void {
    // Sincronización dinámica de métodos de pago desde el backend
    this.http.get<any[]>('/api/catalogos/metodos-pago').subscribe({
      next: (lista) => {
        if (Array.isArray(lista) && lista.length > 0) {
          const ef = lista.find(m => m.nombreMetodo?.toUpperCase().includes('EFECTIVO'));
          const tj = lista.find(m => m.nombreMetodo?.toUpperCase().includes('TARJETA'));
          const yp = lista.find(m => m.nombreMetodo?.toUpperCase().includes('YAPE'));
          const tr = lista.find(m => m.nombreMetodo?.toUpperCase().includes('TRANSFERENCIA'));
          if (ef) this.metodosPago[0].id = ef.idMetodoPago;
          if (tj) this.metodosPago[1].id = tj.idMetodoPago;
          if (yp) this.metodosPago[2].id = yp.idMetodoPago;
          if (tr) this.metodosPago[3].id = tr.idMetodoPago;

          const actual = this.metodosPago.find(m => m.tipo === this.metodoSeleccionado().tipo);
          if (actual) {
            this.metodoSeleccionadoId.set(actual.id);
            this.form.patchValue({ idMetodoPago: actual.id });
          }
        }
      },
      error: () => {}
    });

    const alq = this.data.alquiler;
    const inicio = new Date(alq.fechaInicio).getTime();
    const fin = new Date(alq.fechaFinEstimada).getTime();
    this.diasCalculados = alq.dias && alq.dias > 0 ? alq.dias : Math.max(1, Math.round((fin - inicio) / 86_400_000));

    this.categoriaVehiculo = categoriaVehiculo(alq.vehiculo);
    this.montoGarantiaAutomatica = garantiaHold(alq.vehiculo);

    // Monto provisional mientras llega el saldo real del backend
    const totalContrato = alq.precioTotal && alq.precioTotal > 0
      ? alq.precioTotal
      : this.diasCalculados * Number(alq.vehiculo?.precioDia ?? 0);
    this.fijarMonto(this.esDeuda ? 0 : totalContrato);

    // Garantía automática aprobada
    this.form.controls.garantiaConfirmada.setValue(true);

    this.pagoService.obtenerSaldo(alq.idAlquiler!).subscribe({
      next: (saldo) => {
        this.cargandoSaldo = false;
        this.fijarMonto(this.esDeuda ? Number(saldo.saldoDeuda) : Number(saldo.saldoContrato));
      },
      error: () => (this.cargandoSaldo = false)
    });

    this.form.controls.monto.valueChanges.subscribe((v) => this.montoACobrar.set(Number(v ?? 0)));
    this.cambiarMetodo(2);
  }

  private fijarMonto(monto: number): void {
    this.totalSugerido = Math.round(monto * 100) / 100;
    this.montoACobrar.set(this.totalSugerido);
    this.efectivoRecibido.set(this.totalSugerido);
    this.form.patchValue({ monto: this.totalSugerido, montoRecibido: this.totalSugerido });
    this.form.controls.monto.setValidators([
      Validators.required,
      Validators.min(0.01),
      Validators.max(this.totalSugerido)
    ]);
    this.form.controls.monto.updateValueAndValidity();
  }

  onSoloNumeros(campo: 'ultimosDigitos' | 'numeroOperacion', event: Event, maxLen: number): void {
    const input = event.target as HTMLInputElement;
    const soloDigitos = (input.value || '').replace(/\D/g, '').slice(0, maxLen);
    input.value = soloDigitos;
    this.form.get(campo)?.setValue(soloDigitos, { emitEvent: false });
  }

  // Cada método pide datos distintos: se activan sus validaciones
  cambiarMetodo(id: number): void {
    this.metodoSeleccionadoId.set(id);
    this.form.patchValue({ idMetodoPago: id });
    const tipo = this.metodoSeleccionado().tipo;
    const c = this.form.controls;

    c.ultimosDigitos.clearValidators();
    c.numeroOperacion.clearValidators();
    c.bancoOrigen.clearValidators();

    if (tipo === 'pos') {
      c.ultimosDigitos.setValidators([Validators.required, Validators.pattern(/^\d{4}$/)]);
      c.numeroOperacion.setValidators([Validators.required, Validators.pattern(/^\d{1,6}$/)]);
    } else if (tipo === 'yape') {
      c.bancoOrigen.setValidators([Validators.required]);
      c.numeroOperacion.setValidators([Validators.required, Validators.pattern(/^\d{8}$/)]);
    } else if (tipo === 'transferencia') {
      c.bancoOrigen.setValidators([Validators.required]);
      c.numeroOperacion.setValidators([Validators.required, Validators.pattern(/^\d{1,10}$/)]);
    }
    c.ultimosDigitos.updateValueAndValidity();
    c.numeroOperacion.updateValueAndValidity();
    c.bancoOrigen.updateValueAndValidity();
  }

  onRecibidoInput(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value || 0);
    this.efectivoRecibido.set(val);
  }

  // En efectivo no se permite registrar si lo recibido es menor al monto
  get efectivoInsuficiente(): boolean {
    return this.metodoSeleccionado().tipo === 'efectivo' && this.faltaEfectivo() > 0;
  }

  confirmar(): void {
    if (this.form.invalid || this.efectivoInsuficiente) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const tipo = this.metodoSeleccionado().tipo;
    const request: RegistrarPagoRequest = {
      idAlquiler: this.data.alquiler.idAlquiler!,
      idMetodoPago: v.idMetodoPago!,
      monto: Number(v.monto),
      montoRecibido: tipo === 'efectivo' ? this.efectivoRecibido() : null,
      ultimosDigitos: tipo === 'pos' ? (v.ultimosDigitos ?? '').trim() : null,
      numeroOperacion: tipo !== 'efectivo' ? (v.numeroOperacion ?? '').trim() : null,
      bancoOrigen: tipo === 'yape' || tipo === 'transferencia' ? (v.bancoOrigen ?? '').trim() : null,
      garantiaConfirmada: !this.esDeuda && !!v.garantiaConfirmada
    };

    this.cargando = true;
    this.error = null;

    this.pagoService.registrarPago(request).subscribe({
      next: (pago) => {
        this.cargando = false;
        const numeroComprobante = `B001-${String(pago.idPago ?? 0).padStart(6, '0')}`;
        this.dialogRef.close({
          exito: true,
          pago,
          modo: this.esDeuda ? 'DEUDA' : 'ALQUILER',
          metodo: this.metodoSeleccionado().nombre,
          comprobante: numeroComprobante,
          vuelto: pago.vuelto ?? 0,
          garantia: {
            monto: this.montoGarantiaAutomatica,
            categoria: this.categoriaVehiculo
          }
        });
      },
      error: (err) => {
        this.cargando = false;
        this.error = err.error?.message || 'No se pudo registrar el pago. Intenta nuevamente.';
      }
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
