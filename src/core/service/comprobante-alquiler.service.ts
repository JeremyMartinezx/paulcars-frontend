import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Alquiler } from '../models/alquiler.model';
import { VisorPdfDialogComponent } from '../../shared/components/visor-pdf-dialog/visor-pdf-dialog.component';
import { formatearCodigoAlquiler } from '../utils/reglas-negocio.util';
import { AlquilerService } from './alquiler.service';
import { PagoService } from './pago.service';

// Comprobante (PDF) de una reserva, igual para administrador, asesor y cliente:
//  - Reserva pagada y alquiler en ruta → la boleta electrónica
//  - Alquiler finalizado              → dos documentos en el mismo visor: la boleta y el acta de finalización
//  - Solicitud, reserva por pagar, cancelada o rechazada → no hay comprobante
@Injectable({ providedIn: 'root' })
export class ComprobanteAlquilerService {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly alquilerService = inject(AlquilerService);
  private readonly pagoService = inject(PagoService);

  // `reservaPagada` la informa la pantalla que ya lo calcula para el estado de la fila
  tieneComprobante(a: Alquiler, reservaPagada: boolean): boolean {
    const est = (a.estado?.nombreEstado || '').toUpperCase();
    if (['ACTIVO', 'EN_CURSO', 'EN CURSO', 'FINALIZADO', 'CERRADO_CON_DEUDA'].includes(est)) return true;
    if (['RESERVADO', 'APROBADO', 'PAGADO', 'CONFIRMADO'].includes(est)) return reservaPagada;
    return false;
  }

  abrir(a: Alquiler): void {
    const id = a.idAlquiler;
    if (!id) return;
    const codigo = formatearCodigoAlquiler(id);
    const est = (a.estado?.nombreEstado || '').toUpperCase();

    const finalizado = est === 'FINALIZADO' || est === 'CERRADO_CON_DEUDA';
    const acta = {
      etiqueta: 'Acta de finalización',
      titulo: 'Acta de finalización',
      subtitulo: codigo,
      pdf$: this.alquilerService.descargarActaFinalizacion(id),
      nombreArchivo: `FINALIZACION-${codigo.replace(/[^A-Z0-9-]/gi, '')}.pdf`
    };

    // Boleta del último pago del servicio (la liquidación y los reembolsos no cuentan)
    this.pagoService.listarPorAlquiler(id).subscribe({
      next: (pagos) => {
        const ultimo = pagos
          .filter((p) => (!p.tipoPago || p.tipoPago === 'ALQUILER') && Number(p.montoTotal) > 0)
          .sort((x, y) => (x.idPago ?? 0) - (y.idPago ?? 0))
          .pop();
        if (!ultimo?.idPago) {
          if (finalizado) this.abrirVisor('Acta de finalización', codigo, acta.pdf$, acta.nombreArchivo);
          else this.snackBar.open('Esta reserva todavía no tiene una boleta emitida.', 'Cerrar', { duration: 5000 });
          return;
        }
        const nombre = `REC-${String(ultimo.idPago).padStart(6, '0')}`;
        const boleta = {
          etiqueta: 'Boleta de venta',
          titulo: 'Boleta de venta electrónica',
          subtitulo: nombre,
          pdf$: this.pagoService.descargarRecibo(ultimo.idPago),
          nombreArchivo: `BOLETA-${nombre}.pdf`
        };
        if (finalizado) {
          this.dialog.open(VisorPdfDialogComponent, {
            width: '860px',
            maxWidth: '96vw',
            data: { ...acta, documentos: [acta, boleta] }
          });
        } else {
          this.abrirVisor(boleta.titulo, nombre, boleta.pdf$, boleta.nombreArchivo);
        }
      },
      error: () => {
        if (finalizado) this.abrirVisor('Acta de finalización', codigo, acta.pdf$, acta.nombreArchivo);
        else this.snackBar.open('No se pudo obtener la boleta de esta reserva.', 'Cerrar', { duration: 5000 });
      }
    });
  }

  private abrirVisor(titulo: string, subtitulo: string, pdf$: ReturnType<PagoService['descargarRecibo']>, nombreArchivo: string): void {
    this.dialog.open(VisorPdfDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      data: { titulo, subtitulo, pdf$, nombreArchivo }
    });
  }
}
