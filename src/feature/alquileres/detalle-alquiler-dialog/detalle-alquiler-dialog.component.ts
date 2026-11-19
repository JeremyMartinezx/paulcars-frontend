import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Alquiler, HistorialEstado } from '../../../core/models/alquiler.model';
import { Pago } from '../../../core/models/pago.model';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { AuthService } from '../../../core/service/auth.service';
import { PagoService } from '../../../core/service/pago.service';
import {
  formatearFechaHora,
  formatearFechaHoraExacta,
  textoDiferenciaMin
} from '../../../core/utils/descarga.util';
import { etiquetaEstadoAlquiler, formatearCodigoAlquiler } from '../../../core/utils/reglas-negocio.util';
import { etiquetaCombustible } from '../../../core/utils/combustible.util';

export interface DetalleAlquilerData {
  alquiler: Alquiler;
}

// Ficha única de una reserva (solicitud, reserva, alquiler en ruta o finalizado) para el personal y el cliente.
// La tabla muestra solo lo esencial; aquí se ve todo el proceso. El PDF tiene su propia columna (Comprobante).
// Las secciones cambian según el estado y el rol (el cliente no ve datos internos).
import { DanosAlquiler, etiquetaGravedad, etiquetaTipoDano, etiquetaZona } from '../../../core/models/dano.model';
import { resolverUrlImagen } from '../../../core/utils/imagen-url.util';

@Component({
  selector: 'app-detalle-alquiler-dialog',
  standalone: true,
  imports: [DecimalPipe, NgTemplateOutlet, MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule],
  templateUrl: './detalle-alquiler-dialog.component.html',
  styleUrl: './detalle-alquiler-dialog.component.css'
})
export class DetalleAlquilerDialogComponent implements OnInit {
  readonly data: DetalleAlquilerData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DetalleAlquilerDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly alquilerService = inject(AlquilerService);
  private readonly pagoService = inject(PagoService);
  private readonly authService = inject(AuthService);

  readonly a = this.data.alquiler;
  readonly fechaHora = formatearFechaHoraExacta;
  // Entrega y devolución las registra una persona con la hora (sin segundos)
  readonly fechaHoraMin = formatearFechaHora;
  readonly codigo = formatearCodigoAlquiler(this.a.idAlquiler);
  // El personal (administrador y asesor) ve el detalle operativo; el cliente, su versión
  readonly esPersonal = this.authService.rolActual() !== 'CLIENTE';
  // Tres vistas: el administrador ve todo el detalle; el asesor, lo necesario para atender; el cliente, lo esencial
  readonly esAdmin = this.authService.rolActual() === 'ADMIN';
  readonly est = (this.a.estado?.nombreEstado || '').toUpperCase();

  readonly pagos = signal<Pago[]>([]);
  readonly historial = signal<HistorialEstado[]>([]);
  readonly pagosCargados = signal(false);

  // Daños del vehículo: estado inicial, daños nuevos y, si ya se evaluaron, cómo se repartió el costo
  readonly danos = signal<DanosAlquiler | null>(null);
  readonly etiquetaZona = etiquetaZona;
  readonly etiquetaTipoDano = etiquetaTipoDano;
  readonly etiquetaGravedad = etiquetaGravedad;
  readonly foto = resolverUrlImagen;

  // Pagos del contrato (la liquidación del check-out no cuenta para el saldo del alquiler)
  readonly pagado = computed(() =>
    this.pagos()
      .filter((p) => p.tipoPago !== 'LIQUIDACION')
      .reduce((suma, p) => suma + Number(p.montoTotal), 0)
  );
  readonly total = Number(this.a.precioTotal ?? 0);
  readonly saldo = computed(() => Math.max(0, this.total - this.pagado()));

  ngOnInit(): void {
    const id = this.a.idAlquiler;
    if (!id) return;
    this.pagoService.listarPorAlquiler(id).subscribe({
      next: (p) => { this.pagos.set(p); this.pagosCargados.set(true); },
      error: () => { this.pagos.set([]); this.pagosCargados.set(true); }
    });
    if (this.mostrarDanos) {
      this.alquilerService.danos(id).subscribe({
        next: (d) => this.danos.set(d),
        error: () => this.danos.set(null)
      });
    }
    this.alquilerService.historialDe(id).subscribe({
      next: (h) => this.historial.set(h),
      error: () => this.historial.set([])
    });
  }

  // Los daños se consultan desde que el vehículo se entrega (en ruta, finalizado o con deuda)
  get mostrarDanos(): boolean {
    return ['ACTIVO', 'EN_CURSO', 'EN CURSO', 'FINALIZADO', 'CERRADO_CON_DEUDA'].includes(this.est);
  }

  // ───── Etapa del alquiler (define qué secciones se muestran) ─────

  get esSolicitud(): boolean {
    return this.est === 'PENDIENTE';
  }

  get esReserva(): boolean {
    return ['RESERVADO', 'APROBADO', 'PAGADO', 'CONFIRMADO'].includes(this.est);
  }

  // "Pagado" en la base de datos ya es una reserva pagada; "Reservado" lo es cuando los pagos cubren el total
  get reservaPagada(): boolean {
    if (!this.esReserva) return false;
    if (this.est === 'PAGADO' || this.est === 'CONFIRMADO') return true;
    return this.total > 0 && this.pagado() >= this.total;
  }

  // Reserva aprobada que todavía espera el pago (solo se afirma cuando ya se conocen los pagos)
  get porPagar(): boolean {
    return this.esReserva && this.pagosCargados() && !this.reservaPagada;
  }

  get enRuta(): boolean {
    return ['ACTIVO', 'EN_CURSO', 'EN CURSO'].includes(this.est);
  }

  get tienePagos(): boolean {
    return this.pagos().length > 0;
  }

  get estadoTexto(): string {
    if (this.esReserva) return this.reservaPagada ? 'Reservado · Pagado' : 'Reservado · Por pagar';
    return etiquetaEstadoAlquiler(this.a.estado?.nombreEstado);
  }

  // Título según la etapa: el cliente ve su reserva; el personal, la ficha de trabajo
  get titulo(): string {
    if (this.esSolicitud) return this.esPersonal ? 'Detalle de la solicitud' : 'Tu solicitud';
    if (this.esReserva) {
      if (this.esPersonal) return 'Detalle de la reserva';
      return this.reservaPagada ? 'Tu reserva pagada' : 'Tu reserva';
    }
    if (this.enRuta) return this.esPersonal ? 'Detalle del alquiler en curso' : 'Tu alquiler en curso';
    if (this.esFinalizado) return this.esPersonal ? 'Detalle del alquiler finalizado' : 'Tu alquiler finalizado';
    return 'Detalle del alquiler';
  }

  get iconoTitulo(): string {
    if (this.esSolicitud) return 'description';
    if (this.esReserva && !this.reservaPagada) return 'event_note';
    return 'receipt_long';
  }

  // Dos líneas de importes: antes del pago es un valor estimado; luego, lo cobrado
  get etiquetaTotal(): string {
    if (this.esSolicitud) return 'Importe estimado';
    return this.esFinalizado ? 'Total del alquiler' : 'Total del contrato';
  }

  get mostrarPagado(): boolean {
    return !this.esSolicitud;
  }

  get fechaLimitePago(): string | null {
    return this.porPagar ? this.a.fechaLimitePago ?? null : null;
  }

  // "13/11/2026 a las 12:08"
  get limitePagoTexto(): string {
    const f = this.a.fechaLimitePago ? new Date(this.a.fechaLimitePago) : null;
    if (!f || isNaN(f.getTime())) return '';
    const dd = String(f.getDate()).padStart(2, '0');
    const mm = String(f.getMonth() + 1).padStart(2, '0');
    const hh = String(f.getHours()).padStart(2, '0');
    const mi = String(f.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${f.getFullYear()} a las ${hh}:${mi}`;
  }

  // ───── Textos de la vista sencilla (cliente y asesor) ─────

  get pagoTexto(): string {
    if (this.esReserva && !this.reservaPagada) {
      if (!this.pagosCargados()) return '';
      return this.pagado() > 0 ? `Pagado S/ ${this.monto(this.pagado())} · saldo S/ ${this.monto(this.saldo())}` : 'Pago pendiente';
    }
    if (this.saldo() > 0 && this.pagosCargados()) return `Saldo pendiente S/ ${this.monto(this.saldo())}`;
    const ultimo = [...this.pagos()].filter((p) => (!p.tipoPago || p.tipoPago === 'ALQUILER') && Number(p.montoTotal) > 0).pop();
    const metodo = ultimo?.metodoPago?.nombreMetodo;
    return metodo ? `Pagado · ${this.sede(metodo)}` : 'Pagado';
  }

  get pagoPendiente(): boolean {
    return this.porPagar || (this.pagosCargados() && !this.esSolicitud && this.saldo() > 0);
  }

  private monto(v: number): string {
    return v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get categoria(): string {
    return this.vehiculo?.tipo?.nombreTipo || '';
  }

  get sedeRecojoTexto(): string {
    return this.sede(this.a.sedeRecojo || this.a.vehiculoUnidad?.sede);
  }

  // "MIRAFLORES" → "Miraflores"
  sede(nombre?: string | null): string {
    const t = (nombre || '').trim().toLowerCase();
    return t.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  }

  // El historial, contado en palabras sencillas: qué pasó y cuándo
  frase(h: HistorialEstado): string {
    switch ((h.estadoNuevo || '').toUpperCase()) {
      case 'PENDIENTE':
        return 'Solicitud enviada';
      case 'RESERVADO':
      case 'APROBADO':
        // Sin estado anterior: la reserva se registró directamente en counter, sin solicitud previa
        return h.estadoAnterior ? 'Reserva aprobada · Pago pendiente' : 'Reserva registrada';
      case 'PAGADO':
      case 'CONFIRMADO':
        return 'Pago recibido';
      case 'ACTIVO':
      case 'EN_CURSO':
        return 'Vehículo entregado';
      case 'FINALIZADO':
        return 'Vehículo devuelto';
      case 'CERRADO_CON_DEUDA':
        return 'Vehículo devuelto, con saldo pendiente';
      default:
        return this.etiquetaEstado(h.estadoNuevo);
    }
  }

  readonly etiquetaCombustible = etiquetaCombustible;

  get kmRecorridos(): number | null {
    const salida = this.a.kmEntrega;
    const llegada = this.a.kmDevolucion;
    if (salida === null || salida === undefined || llegada === null || llegada === undefined) return null;
    return Math.max(0, llegada - salida);
  }

  get observacionRecepcion(): string {
    const o = (this.a.actaObservaciones || '').trim();
    // El texto automático que se guardaba antes ("Se recibieron las llaves…") no aporta: solo se muestran observaciones reales
    return o && !/^sin observaciones/i.test(o) && !/^se recibieron las llaves/i.test(o) ? o : '';
  }

  // ───── Datos del cliente / vehículo ─────

  get clienteNombre(): string {
    const c = this.a.cliente;
    return c ? `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() : '—';
  }

  get vehiculoNombre(): string {
    const v: any = this.a.vehiculo;
    const marca = v?.modelo?.marca?.nombreMarca || v?.marca?.nombreMarca || '';
    const modelo = v?.modelo?.modelo || v?.nombreModelo || '';
    return `${marca} ${modelo}`.trim() || 'Vehículo';
  }

  get vehiculoImagen(): string {
    return obtenerImagenVehiculo(this.a.vehiculo as any) || 'images/default-car.png';
  }

  get placa(): string {
    return (this.a.placa || this.a.vehiculoUnidad?.placa || '').trim() || 'Por asignar';
  }

  get vehiculo(): any {
    return this.a.vehiculo as any;
  }

  // ───── Periodo: pactado vs real ─────

  fechaLarga(f?: string | null): string {
    return f ? f.split('-').reverse().join('/') : '—';
  }

  get recojoPactado(): string {
    const a = this.a;
    return `${this.fechaLarga(a.fechaInicio)} ${a.horaRecojo || ''}`.trim() + (a.horaRecojo ? ' hrs' : '');
  }

  get devolucionPactada(): string {
    const a = this.a;
    return `${this.fechaLarga(a.fechaFinEstimada)} ${a.horaDevolucion || ''}`.trim() + (a.horaDevolucion ? ' hrs' : '');
  }

  private diferencia(fecha: string | undefined, hora: string | undefined, real?: string | null): number | null {
    if (!real || !fecha || !hora) return null;
    const pactada = new Date(`${fecha}T${hora}:00`).getTime();
    const efectiva = new Date(real).getTime();
    if (isNaN(pactada) || isNaN(efectiva)) return null;
    return Math.round((efectiva - pactada) / 60000);
  }

  get difRecojo(): number | null {
    return this.diferencia(this.a.fechaInicio, this.a.horaRecojo, this.a.fechaEntrega);
  }

  get difDevolucion(): number | null {
    return this.diferencia(this.a.fechaFinEstimada, this.a.horaDevolucion, this.a.fechaCheckout);
  }

  textoDif = textoDiferenciaMin;

  claseDif(min: number | null): string {
    if (min === null) return 'dif-nd';
    if (Math.abs(min) <= 5) return 'dif-ok';
    return min > 0 ? 'dif-tarde' : 'dif-antes';
  }

  // ───── Entrega de llaves ─────

  get checklistEntrega(): string[] {
    return (this.a.checklistEntrega || '').split('|').filter((x) => x.trim().length > 0);
  }

  get entregado(): boolean {
    return !!this.a.fechaEntrega;
  }

  // ───── Historial ─────

  etiquetaEstado(e?: string | null): string {
    if (!e) return 'Registro inicial';
    // Reservado y Pagado son estados distintos: se distinguen para que el historial no diga "Reservado → Reservado"
    switch (e.toUpperCase()) {
      case 'RESERVADO':
        return 'Reservado · Por pagar';
      case 'PAGADO':
      case 'CONFIRMADO':
        return 'Reservado · Pagado';
      default:
        return etiquetaEstadoAlquiler(e);
    }
  }

  get esFinalizado(): boolean {
    return this.est === 'FINALIZADO' || this.est === 'CERRADO_CON_DEUDA';
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
