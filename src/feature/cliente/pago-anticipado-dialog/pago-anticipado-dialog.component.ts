import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as QRCode from 'qrcode';

import { Alquiler } from '../../../core/models/alquiler.model';
import { PagoService } from '../../../core/service/pago.service';
import { TransaccionPagoResponse } from '../../../core/models/pago.model';

export interface PagoAnticipadoDialogData {
  alquiler: Alquiler;
  modo?: 'ALQUILER' | 'DEUDA';
}

export type MetodoTab = 'YAPE' | 'PLIN' | 'TARJETA';
export type PasoPago = 'SELECCION' | 'FORMULARIO';

@Component({
  selector: 'app-pago-anticipado-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './pago-anticipado-dialog.component.html',
  styleUrl: './pago-anticipado-dialog.component.css'
})
export class PagoAnticipadoDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<PagoAnticipadoDialogComponent>);
  private readonly pagoService = inject(PagoService);
  readonly data: PagoAnticipadoDialogData = inject(MAT_DIALOG_DATA);

  readonly esDeuda = this.data.modo === 'DEUDA';
  totalMonto = 0;

  // Flujo en 2 pasos con carga transaccional
  readonly paso = signal<PasoPago>('SELECCION');
  readonly metodoActivo = signal<MetodoTab | null>(null);

  readonly cargandoMetodo = signal<boolean>(false);
  readonly mensajeCargandoMetodo = signal<string>('Iniciando pasarela de pago...');

  readonly procesando = signal<boolean>(false);
  readonly mensajeProcesando = signal<string>('Procesando pago seguro...');
  readonly error = signal<string | null>(null);
  readonly pagoExitoso = signal<TransaccionPagoResponse | null>(null);

  // 1. Formulario Tarjeta de Crédito / Débito
  readonly tarjetaForm = this.fb.group({
    numeroTarjeta: ['', [Validators.required, Validators.minLength(16)]],
    titular: ['', [Validators.required, Validators.minLength(3)]],
    vencimiento: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
  });

  // 2. Formulario Yape
  readonly yapeForm = this.fb.group({
    celular: ['', [Validators.required, Validators.pattern(/^9\d{8}$/)]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  // 3. Estado Plin (Código QR Escaneable)
  readonly qrDataUrl = signal<string>('');
  readonly segundosRestantesPlin = signal<number>(300);
  private timerPlinId: any = null;

  readonly tiempoPlinFormateado = computed(() => {
    const s = this.segundosRestantesPlin();
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const seg = (s % 60).toString().padStart(2, '0');
    return `${min}:${seg}`;
  });

  readonly marcaTarjeta = computed(() => {
    const num = (this.tarjetaForm.controls.numeroTarjeta.value || '').replace(/\D/g, '');
    if (num.startsWith('4')) return 'VISA';
    if (num.startsWith('5')) return 'MASTERCARD';
    if (num.startsWith('3')) return 'AMEX';
    return 'TARJETA';
  });

  ngOnInit(): void {
    const alq = this.data.alquiler;
    this.totalMonto = Number(alq.precioTotal ?? 0);
    if (this.totalMonto <= 0 && alq.vehiculo?.precioDia) {
      this.totalMonto = Number(alq.vehiculo.precioDia) * Number(alq.dias ?? 1);
    }
  }

  ngOnDestroy(): void {
    this.detenerTimerPlin();
  }

  nombreVehiculo(): string {
    const v: any = this.data.alquiler?.vehiculo;
    if (!v) return 'Vehículo';
    const marca = v.modelo?.marca?.nombreMarca || v.marca?.nombreMarca || '';
    const modelo = v.modelo?.modelo || v.nombreModelo || '';
    return `${marca} ${modelo}`.trim() || 'Vehículo';
  }

  seleccionarMetodo(metodo: MetodoTab): void {
    this.cargandoMetodo.set(true);
    this.metodoActivo.set(metodo);
    this.error.set(null);

    const nombreMetodo = metodo === 'TARJETA' ? 'Tarjeta' : (metodo === 'YAPE' ? 'Yape' : 'Plin');
    this.mensajeCargandoMetodo.set(`Cargando pasarela de pago seguro con ${nombreMetodo}...`);

    setTimeout(() => {
      this.cargandoMetodo.set(false);
      this.paso.set('FORMULARIO');

      if (metodo === 'TARJETA') {
        this.tarjetaForm.reset({
          numeroTarjeta: '',
          titular: '',
          vencimiento: '',
          cvv: ''
        });
        this.tarjetaForm.markAsPristine();
        this.tarjetaForm.markAsUntouched();
      } else if (metodo === 'YAPE') {
        this.yapeForm.reset({
          celular: '',
          otp: ''
        });
        this.yapeForm.markAsPristine();
        this.yapeForm.markAsUntouched();
      } else if (metodo === 'PLIN') {
        this.iniciarTimerPlin();
        this.generarQrRealPlin();
      }
    }, 600);
  }

  formatearNumeroTarjeta(event: any): void {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length > 16) input = input.substring(0, 16);
    const parts = input.match(/.{1,4}/g);
    const formateado = parts ? parts.join(' ') : input;
    this.tarjetaForm.controls.numeroTarjeta.setValue(formateado, { emitEvent: false });
  }

  formatearVencimiento(event: any): void {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length > 4) input = input.substring(0, 4);
    if (input.length >= 3) {
      input = `${input.substring(0, 2)}/${input.substring(2)}`;
    }
    this.tarjetaForm.controls.vencimiento.setValue(input, { emitEvent: false });
  }

  formatearCvv(event: any): void {
    let input = event.target.value.replace(/\D/g, '');
    if (input.length > 4) input = input.substring(0, 4);
    this.tarjetaForm.controls.cvv.setValue(input, { emitEvent: false });
  }

  generarQrRealPlin(): void {
    const alq = this.data.alquiler;
    const payload = `PLIN|PAUL CARS SAC|MONTO:${this.totalMonto.toFixed(2)}|CONTRATO:${alq.idAlquiler}|REF:${Date.now()}`;
    QRCode.toDataURL(payload, {
      width: 200,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    }).then((url: string) => {
      this.qrDataUrl.set(url);
    }).catch((err: any) => {
      console.error('Error generando QR Plin:', err);
    });
  }

  iniciarTimerPlin(): void {
    this.detenerTimerPlin();
    this.segundosRestantesPlin.set(300);
    this.timerPlinId = setInterval(() => {
      const actual = this.segundosRestantesPlin();
      if (actual > 0) {
        this.segundosRestantesPlin.set(actual - 1);
      } else {
        this.detenerTimerPlin();
      }
    }, 1000);
  }

  detenerTimerPlin(): void {
    if (this.timerPlinId) {
      clearInterval(this.timerPlinId);
      this.timerPlinId = null;
    }
  }

  pagarConTarjeta(): void {
    if (this.tarjetaForm.invalid) {
      this.tarjetaForm.markAllAsTouched();
      return;
    }

    this.procesando.set(true);
    this.mensajeProcesando.set('Validando tarjeta de forma segura...');
    this.error.set(null);

    const val = this.tarjetaForm.getRawValue();
    const numeroLimpio = (val.numeroTarjeta || '').replace(/\D/g, '');
    const ultimos4 = numeroLimpio.slice(-4) || '0000';
    const marca = this.marcaTarjeta();
    const titular = (val.titular || '').trim().toUpperCase();
    const tokenSeguro = `tok_culqi_live_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    setTimeout(() => {
      this.mensajeProcesando.set('Confirmando cobro bancario seguro...');
      this.pagoService.pagarConTarjeta({
        idAlquiler: this.data.alquiler.idAlquiler!,
        token: tokenSeguro,
        marca: marca,
        ultimosCuatroDigitos: ultimos4,
        titular: titular,
        monto: this.totalMonto
      }).subscribe({
        next: (res: TransaccionPagoResponse) => {
          this.procesando.set(false);
          this.pagoExitoso.set(res);
        },
        error: (err) => {
          this.procesando.set(false);
          this.error.set(err.error?.message || 'No se pudo procesar el cobro con la tarjeta. Verifica los datos ingresados.');
        }
      });
    }, 1100);
  }

  pagarConYape(): void {
    if (this.yapeForm.invalid) {
      this.yapeForm.markAllAsTouched();
      return;
    }

    this.procesando.set(true);
    this.mensajeProcesando.set('Verificando pago en tiempo real con Yape...');
    this.error.set(null);

    const val = this.yapeForm.getRawValue();

    setTimeout(() => {
      this.pagoService.pagarConYape({
        idAlquiler: this.data.alquiler.idAlquiler!,
        celular: val.celular!,
        otp: val.otp!,
        monto: this.totalMonto
      }).subscribe({
        next: (res: TransaccionPagoResponse) => {
          this.procesando.set(false);
          this.pagoExitoso.set(res);
        },
        error: (err) => {
          this.procesando.set(false);
          this.error.set(err.error?.message || 'No se pudo procesar el pago con Yape. Verifica el código ingresado.');
        }
      });
    }, 1100);
  }

  pagarConPlin(): void {
    this.procesando.set(true);
    this.mensajeProcesando.set('Verificando confirmación de pago Plin...');
    this.error.set(null);

    setTimeout(() => {
      this.pagoService.pagarConPlin({
        idAlquiler: this.data.alquiler.idAlquiler!,
        banco: 'INTEROPERABLE',
        monto: this.totalMonto
      }).subscribe({
        next: (res: TransaccionPagoResponse) => {
          this.procesando.set(false);
          this.pagoExitoso.set(res);
        },
        error: (err) => {
          this.procesando.set(false);
          this.error.set(err.error?.message || 'Error al validar el pago Plin QR.');
        }
      });
    }, 1100);
  }

  finalizarYVolver(): void {
    const res = this.pagoExitoso();
    this.dialogRef.close({
      exito: true,
      metodo: res?.metodo || 'TARJETA',
      transactionId: res?.transactionId,
      response: res
    });
  }

  cancelar(): void {
    if (this.pagoExitoso()) {
      this.finalizarYVolver();
    } else {
      this.dialogRef.close();
    }
  }
}
