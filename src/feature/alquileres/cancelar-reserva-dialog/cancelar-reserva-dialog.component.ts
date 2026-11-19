import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import {
  Alquiler,
  MotivoCancelacion,
  PreviaCancelacion
} from '../../../core/models/alquiler.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { AuthService } from '../../../core/service/auth.service';
import { formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';

export interface CancelarReservaData {
  alquiler: Alquiler;
}

interface OpcionMotivo {
  valor: MotivoCancelacion;
  titulo: string;
  ayudaSinPago: string;
  ayudaConPago: string;
  soloSinPago?: boolean;
  soloConPago?: boolean;
}

// Cancelar una reserva ya aprobada (con o sin pago) 
@Component({
  selector: 'app-cancelar-reserva-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './cancelar-reserva-dialog.component.html',
  styleUrl: './cancelar-reserva-dialog.component.css'
})
export class CancelarReservaDialogComponent implements OnInit {
  readonly data: CancelarReservaData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CancelarReservaDialogComponent>);
  private readonly alquilerService = inject(AlquilerService);
  private readonly authService = inject(AuthService);

  readonly a = this.data.alquiler;
  readonly codigo = formatearCodigoAlquiler(this.a.idAlquiler);
  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');

  readonly previa = signal<PreviaCancelacion | null>(null);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  readonly motivo = signal<MotivoCancelacion>('CLIENTE_SOLICITO');

  // Cada motivo explica en una sola frase qué pasa, según la reserva tenga pago o no
  readonly motivos: OpcionMotivo[] = [
    {
      valor: 'CLIENTE_SOLICITO',
      titulo: 'El cliente pidió cancelar',
      ayudaSinPago: 'Se libera el vehículo; no hay pagos que devolver.',
      ayudaConPago: 'La devolución depende de la anticipación.'
    },
    {
      valor: 'NO_PAGO_EN_PLAZO',
      titulo: 'No pagó dentro del plazo',
      ayudaSinPago: 'Se libera el vehículo para otros clientes.',
      ayudaConPago: '',
      soloSinPago: true
    },
    {
      valor: 'VEHICULO_NO_DISPONIBLE',
      titulo: 'Vehículo no disponible',
      ayudaSinPago: '',
      ayudaConPago: 'Solo si no hay ningún vehículo equivalente que entregar: devolución total.',
      soloConPago: true
    },
    {
      valor: 'NO_SE_PRESENTO',
      titulo: 'El cliente no se presentó',
      ayudaSinPago: '',
      ayudaConPago: 'No corresponde devolución.',
      soloConPago: true
    }
  ];

  // Solo se ofrecen los motivos que tienen sentido para el estado de la reserva (por pagar o ya pagada)
  readonly motivosVisibles = computed(() => {
    const p = this.previa();
    if (!p) return [];
    const conPago = p.tienePagos;
    return this.motivos
      .filter((m) => (conPago ? !m.soloSinPago : !m.soloConPago))
      .map((m) => ({ valor: m.valor, titulo: m.titulo, ayuda: conPago ? m.ayudaConPago : m.ayudaSinPago }));
  });

  private readonly metodos = computed(() => (this.previa()?.metodosPago || '').toUpperCase().split(' + ').filter((m) => !!m));
  readonly esEfectivo = computed(() => this.metodos().length > 0 && this.metodos().every((m) => m.includes('EFECTIVO')));

  // Qué va a pasar con el dinero, dicho según cómo pagó el cliente
  readonly textoDevolucion = computed(() => {
    const p = this.previa();
    if (!p || !p.tienePagos || p.montoReembolso <= 0) return '';
    const monto = `S/ ${p.montoReembolso.toFixed(2)}`;
    const nota = 'Se emitirá la nota de crédito electrónica que modifica la boleta.';
    if (this.esEfectivo()) {
      return `Entregue ${monto} en efectivo al cliente. ${nota}`;
    }
    const plazo = (p.plazoDevolucion || '').replace(/^./, (c) => c.toLowerCase());
    return `La devolución de ${monto} se enviará automáticamente por ${p.metodosPago.toLowerCase()}. `
      + (plazo ? `Plazo de llegada: ${plazo}. ` : '') + nota;
  });

  readonly bloqueado = computed(() => !!this.previa() && !this.previa()!.puedeCancelarElUsuario);

  readonly puedeConfirmar = computed(() => {
    if (this.enviando() || this.cargando()) return false;
    if (this.bloqueado()) return false;
    return true;
  });

  readonly textoConfirmar = computed(() => {
    const p = this.previa();
    if (p?.tienePagos && p.montoReembolso > 0) return `Cancelar y devolver S/ ${p.montoReembolso.toFixed(2)}`;
    return 'Cancelar reserva';
  });

  ngOnInit(): void {
    this.cargarPrevia();
  }

  cargarPrevia(): void {
    this.alquilerService.previaCancelacion(this.a.idAlquiler!, this.motivo()).subscribe({
      next: (p) => {
        this.previa.set(p);
        this.cargando.set(false);
        // Un reserva con pagos no puede cancelarse por "no pagó"
        if (p.tienePagos && this.motivo() === 'NO_PAGO_EN_PLAZO') {
          this.motivo.set('CLIENTE_SOLICITO');
          this.cargarPrevia();
        }
      },
      error: (err) => {
        this.cargando.set(false);
        if (this.yaNoVigente(err)) return;
        this.error.set(err?.error?.message || 'No se pudo calcular la cancelación.');
      }
    });
  }

  elegirMotivo(m: MotivoCancelacion): void {
    this.motivo.set(m);
    this.cargarPrevia();
  }

  get vehiculoNombre(): string {
    const v: any = this.a.vehiculo;
    const marca = v?.modelo?.marca?.nombreMarca || v?.marca?.nombreMarca || '';
    const modelo = v?.modelo?.modelo || v?.nombreModelo || '';
    return `${marca} ${modelo}`.trim() || 'Vehículo';
  }

  get clienteNombre(): string {
    const c = this.a.cliente;
    return c ? `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() : '';
  }

  fechaHoraLarga(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  confirmar(): void {
    if (!this.puedeConfirmar()) return;
    this.enviando.set(true);
    this.error.set(null);
    const id = this.a.idAlquiler!;

    this.alquilerService
      .cancelarReserva(id, {
        motivo: this.motivo(),
        observaciones: null,
        codigoOperacion: null
      })
      .subscribe({
        next: (r) => this.dialogRef.close({ accion: 'CANCELADA', mensaje: r.mensaje }),
        error: (err) => this.fallo(err)
      });
  }

  // Si la reserva ya se canceló sola (plazo vencido) o cambió de estado, no se muestra un error: se cierra y se refresca la lista
  private yaNoVigente(err: any): boolean {
    if (err?.status !== 409 && err?.status !== 404) return false;
    const msg: string = err?.error?.message || '';
    if (err.status === 409 && !/ya no|todav[ií]a|aprobada|cancelad/i.test(msg)) return false;
    this.dialogRef.close({ accion: 'ACTUALIZAR', mensaje: 'La reserva ya había sido cancelada automáticamente. Se actualizó la lista.' });
    return true;
  }

  private fallo(err: any): void {
    this.enviando.set(false);
    if (this.yaNoVigente(err)) return;
    this.error.set(err?.error?.message || 'No se pudo completar la operación.');
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
