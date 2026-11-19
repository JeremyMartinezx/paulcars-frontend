import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { Alquiler, Devolucion } from '../../../core/models/alquiler.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { AuthService } from '../../../core/service/auth.service';
import { PagoService } from '../../../core/service/pago.service';
import { formatearCodigoAlquiler, motivoDeCierre } from '../../../core/utils/reglas-negocio.util';
import { VisorPdfDialogComponent } from '../visor-pdf-dialog/visor-pdf-dialog.component';

export interface DevolucionDialogData {
  alquiler: Alquiler;
}

// Detalle de una reserva cancelada o rechazada: por qué quedó así y, si hubo pago, qué pasó con el dinero
@Component({
  selector: 'app-devolucion-dialog',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './devolucion-dialog.component.html',
  styleUrl: './devolucion-dialog.component.css'
})
export class DevolucionDialogComponent implements OnInit {
  readonly data: DevolucionDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DevolucionDialogComponent>);
  private readonly alquilerService = inject(AlquilerService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly pagoService = inject(PagoService);

  readonly a = this.data.alquiler;
  readonly codigo = formatearCodigoAlquiler(this.a.idAlquiler);
  // El personal (administrador y asesor) ve el detalle operativo; el cliente, su versión redactada para él
  readonly esPersonal = this.authService.rolActual() !== 'CLIENTE';
  readonly motivo = motivoDeCierre(this.a, this.esPersonal);
  readonly esRechazo = (this.a.estado?.nombreEstado || '').toUpperCase().startsWith('RECHAZADO');
  // Momento en que se canceló o se rechazó (en un rechazo es el último cambio de estado)
  readonly fechaCierre = this.a.fechaCancelacion || this.a.fechaUltimoEstado || null;
  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');

  readonly dev = signal<Devolucion | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Una solicitud rechazada nunca tuvo pago: no hay devolución que consultar
    if (this.esRechazo) {
      this.cargando.set(false);
      return;
    }
    this.alquilerService.devolucion(this.a.idAlquiler!).subscribe({
      next: (d) => {
        this.dev.set(d);
        this.alquilerService.guardarDevolucion(d);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        // La lista estaba desactualizada y la reserva ya no existe: se cierra y se refresca, sin mostrar un error
        if (err?.status === 404) {
          this.dialogRef.close({ accion: 'ACTUALIZAR' });
          return;
        }
        this.error.set(err?.error?.message || 'No se pudo cargar el detalle.');
      }
    });
  }

  get clienteNombre(): string {
    const c = this.a.cliente;
    return c ? `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() : '';
  }

  // "MIRAFLORES" → "Miraflores": la sede donde se hizo el trámite de la reserva
  get sede(): string {
    const t = (this.a.sedeRecojo || '').trim().toLowerCase();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  esEfectivo(d: Devolucion): boolean {
    return d.metodos.toUpperCase().includes('EFECTIVO');
  }

  private monto(v: number): string {
    return 'S/ ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private metodoLegible(d: Devolucion): string {
    const m = d.metodos.toLowerCase();
    return m.charAt(0).toUpperCase() + m.slice(1);
  }

  // Titular de la devolución: lo más importante en una línea
  tituloDevolucion(d: Devolucion): string {
    if (d.estado === 'SIN_DEVOLUCION') return 'No corresponde devolución';
    return d.estado === 'EN_TRAMITE' ? `${this.monto(d.montoDevuelto)} en trámite de devolución` : `${this.monto(d.montoDevuelto)} devueltos`;
  }

  etiquetaDevolucion(d: Devolucion): string {
    return d.estado === 'DEVUELTA' ? 'Devolución realizada' : d.estado === 'EN_TRAMITE' ? 'Devolución en trámite' : 'Sin devolución';
  }

  // "2026-11-13" → "13/11/2026"
  fechaCorta(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, dd] = iso.split('-');
    return `${dd}/${m}/${y}`;
  }

  // Por qué se devolvió ese porcentaje (según la política de cancelación)
  razonPorcentaje(d: Devolucion): string {
    switch (this.a.motivoCancelacion) {
      case 'NO_SE_PRESENTO':
        return 'El cliente no se presentó a recoger el vehículo dentro del plazo de entrega.';
      case 'VEHICULO_NO_DISPONIBLE':
        return "La cancelación se debe a Paul Car's, por eso se devuelve el 100 % del monto pagado.";
      default: {
        const pct = d.montoPagado > 0 ? Math.round((d.montoDevuelto / d.montoPagado) * 100) : 0;
        if (pct >= 100) return 'Se canceló con 48 horas o más de anticipación al recojo, por eso se devuelve el 100 %.';
        if (pct > 0) return 'Se canceló con entre 24 y 48 horas de anticipación al recojo, por eso se devuelve el 50 % del monto pagado.';
        return 'Se canceló con menos de 24 horas de anticipación al recojo.';
      }
    }
  }

  // Una sola explicación: cuánto, cómo, cuándo y dónde
  textoDevolucion(d: Devolucion): string {
    if (d.estado === 'SIN_DEVOLUCION') {
      return 'Según la política de cancelación, el monto pagado no es reembolsable. ' + this.razonPorcentaje(d);
    }
    const cuando = this.fechaHora(d.fechaDevuelta).replace(' - ', ' a las ');
    const porque = this.razonPorcentaje(d) + ' ';
    if (this.esEfectivo(d)) {
      return `${porque}Se entregó en efectivo en la sede ${this.sede || 'principal'} el ${cuando}, el mismo método con el que se pagó.`;
    }
    if (d.estado === 'EN_TRAMITE') {
      return `${porque}Iniciamos la devolución por ${this.metodoLegible(d)} el ${cuando}. Llegará a su cuenta, a más tardar, el ${this.fechaCorta(d.fechaEstimada)}.`;
    }
    return `${porque}Devueltos por ${this.metodoLegible(d)}. Devolución iniciada el ${cuando}.`;
  }

  fechaHora(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()} - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // La boleta emitida sigue vigente: si hubo devolución, la nota de crédito se ve junto a ella (como en un alquiler finalizado)
  verComprobantes(d: Devolucion): void {
    const id = this.a.idAlquiler!;
    this.pagoService.listarPorAlquiler(id).subscribe({
      next: (pagos) => {
        const boletas = pagos
          .filter((p) => (!p.tipoPago || p.tipoPago === 'ALQUILER') && Number(p.montoTotal) > 0 && p.idPago)
          .sort((x, y) => (x.idPago ?? 0) - (y.idPago ?? 0))
          .map((p) => {
            const nombre = `REC-${String(p.idPago).padStart(6, '0')}`;
            return {
              etiqueta: 'Boleta de venta',
              titulo: 'Boleta de venta electrónica',
              subtitulo: nombre,
              pdf$: this.pagoService.descargarRecibo(p.idPago!),
              nombreArchivo: `BOLETA-${nombre}.pdf`
            };
          });
        const notas = d.notasCredito.map((n) => ({
          etiqueta: 'Nota de crédito',
          titulo: 'Nota de crédito electrónica',
          subtitulo: n.numero,
          pdf$: this.alquilerService.descargarNotaCredito(id, n.idBoleta),
          nombreArchivo: `NOTA-CREDITO-${n.numero}.pdf`
        }));
        const documentos = [...boletas, ...notas];
        if (!documentos.length) {
          this.error.set('Esta reserva no tiene comprobantes emitidos.');
          return;
        }
        this.dialog.open(VisorPdfDialogComponent, {
          width: '860px',
          maxWidth: '96vw',
          data: { ...documentos[0], documentos }
        });
      },
      error: () => this.error.set('No se pudieron obtener los comprobantes.')
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
