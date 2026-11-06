import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AlquilerService } from '../../../core/service/alquiler.service';
import { AuthService } from '../../../core/service/auth.service';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { PagoService } from '../../../core/service/pago.service';
import { Alquiler } from '../../../core/models/alquiler.model';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import {
  formatearCodigoAlquiler,
  motivoRechazoLegible,
  LiquidacionAlquiler,
  obtenerLiquidacionAlquiler
} from '../../../core/utils/reglas-negocio.util';
import { PagoAnticipadoDialogComponent } from '../pago-anticipado-dialog/pago-anticipado-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ActaLiquidacionDialogComponent } from '../../alquileres/acta-liquidacion-dialog/acta-liquidacion-dialog.component';

export type { LiquidacionAlquiler };

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './mis-reservas.component.html',
  styleUrl: './mis-reservas.component.css'
})
export class MisReservasComponent implements OnInit {
  private readonly alquilerService = inject(AlquilerService);
  private readonly vehiculoService = inject(VehiculoService);
  private readonly pagoService = inject(PagoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly authService = inject(AuthService);

  readonly filtroEstado = signal<string>('TODOS');
  readonly subfiltroReserva = signal<'TODAS' | 'PAGADAS' | 'POR_PAGAR'>('TODAS');
  readonly subfiltroFinalizado = signal<'TODAS' | 'NORMAL' | 'DEUDA'>('TODAS');
  readonly paginaActual = signal<number>(1);
  readonly tamanoPagina = signal<number>(5);
  readonly alquilerSeleccionado = signal<Alquiler | null>(null);
  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;

  readonly mostrarColumnaAccion = computed(() => {
    const f = this.filtroEstado();
    return f !== 'FINALIZADO' && f !== 'ACTIVO';
  });

  ngOnInit(): void {
    this.vehiculoService.cargar();
    this.alquilerService.cargarMisAlquileres();
    this.pagoService.cargar();
  }

  abrirPagoAnticipado(alquiler: Alquiler, modo: 'ALQUILER' | 'DEUDA' = 'ALQUILER'): void {
    const ref = this.dialog.open(PagoAnticipadoDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: { alquiler, modo }
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.exito) {
        const metodoNombre = res.metodo === 'YAPE' ? 'Yape'
          : res.metodo === 'PLIN' ? 'Plin'
          : res.metodo === 'TARJETA' ? 'Tarjeta de Crédito / Débito'
          : 'Pasarela Digital';

        this.snackBar.open(
          `Pago confirmado exitosamente vía ${metodoNombre}`,
          'Cerrar',
          {
            duration: 6000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          }
        );

        // Actualizar reactivamente todas las listas y alquileres sin recargar la página
        this.alquilerService.cargarMisAlquileres();
        this.alquilerService.cargar();
        this.pagoService.cargar();
      }
    });
  }

  readonly misAlquileres = computed(() => this.alquilerService.misAlquileres() || []);

  readonly totalReservas = computed(() => this.misAlquileres().length);

  readonly reservasActivas = computed(() =>
    this.misAlquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return e === 'PENDIENTE' || e === 'RESERVADO' || e === 'APROBADO' || e === 'PAGADO' || e === 'CONFIRMADO' || e === 'ACTIVO';
    }).length
  );

  esReservaPagada(alq: Alquiler): boolean {
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    if (e === 'PAGADO' || e === 'CONFIRMADO') return true;
    if (alq.idAlquiler) {
      return this.pagoService.pagos().some(
        (p) => p.alquiler?.idAlquiler === alq.idAlquiler && p.tipoPago !== 'LIQUIDACION'
      );
    }
    return false;
  }

  esReservaPorPagar(alq: Alquiler): boolean {
    return !this.esReservaPagada(alq);
  }

  esFinalizadoTotal(alq: Alquiler): boolean {
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    return e === 'FINALIZADO' || e === 'CERRADO_CON_DEUDA' || e === 'CON_DEUDA';
  }

  esFinalizadoNormal(alq: Alquiler): boolean {
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    return e === 'FINALIZADO';
  }

  esFinalizadoConDeuda(alq: Alquiler): boolean {
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    return e === 'CERRADO_CON_DEUDA' || e === 'CON_DEUDA';
  }

  readonly conteoPendientes = computed(() =>
    this.misAlquileres().filter((a) => (a.estado?.nombreEstado || '').toUpperCase() === 'PENDIENTE').length
  );

  readonly conteoReservadas = computed(() =>
    this.misAlquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return e === 'RESERVADO' || e === 'APROBADO' || e === 'PAGADO' || e === 'CONFIRMADO' || e === 'PAGO_EN_REVISION';
    }).length
  );

  readonly conteoReservasPagadas = computed(() =>
    this.misAlquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      const esRes = e === 'RESERVADO' || e === 'APROBADO' || e === 'PAGADO' || e === 'CONFIRMADO' || e === 'PAGO_EN_REVISION';
      return esRes && this.esReservaPagada(a);
    }).length
  );

  readonly conteoReservasPorPagar = computed(() =>
    this.misAlquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      const esRes = e === 'RESERVADO' || e === 'APROBADO' || e === 'PAGADO' || e === 'CONFIRMADO' || e === 'PAGO_EN_REVISION';
      return esRes && this.esReservaPorPagar(a);
    }).length
  );

  readonly conteoEnRuta = computed(() =>
    this.misAlquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return e === 'ACTIVO' || e === 'EN_CURSO' || e === 'EN CURSO';
    }).length
  );

  readonly conteoFinalizadasTotal = computed(() =>
    this.misAlquileres().filter((a) => this.esFinalizadoTotal(a)).length
  );

  readonly conteoFinalizadasNormal = computed(() =>
    this.misAlquileres().filter((a) => this.esFinalizadoNormal(a)).length
  );

  readonly conteoFinalizadasConDeuda = computed(() =>
    this.misAlquileres().filter((a) => this.esFinalizadoConDeuda(a)).length
  );

  readonly reservasFinalizadas = this.conteoFinalizadasTotal;
  readonly conteoFinalizadas = this.conteoFinalizadasTotal;
  readonly conteoConDeuda = this.conteoFinalizadasConDeuda;

  readonly soloHoy = signal<boolean>(false);
  readonly ordenModo = signal<'INTELIGENTE' | 'REGISTRO'>('INTELIGENTE');

  fechaHoyStr(): string {
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  }

  fechaHoyLegible(): string {
    const now = new Date();
    const d = now.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: 'America/Lima' });
    return d.replace('.', '');
  }

  esHoy(fecha?: string): boolean {
    if (!fecha) return false;
    return fecha === this.fechaHoyStr();
  }

  // Verifica si un vehículo está programado para recojo hoy Y aún no ha salido a ruta
  esRecojoHoy(alq?: Alquiler | null): boolean {
    if (!alq || !alq.fechaInicio) return false;
    const hoy = this.fechaHoyStr();
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    const esReservaPorSalir = e === 'RESERVADO' || e === 'PAGADO' || e === 'CONFIRMADO' || e === 'APROBADO';
    return alq.fechaInicio === hoy && esReservaPorSalir;
  }

  // Contador de autos a punto de partir hoy (Reservados / Pagados que esperan recojo hoy)
  readonly conteoParaHoy = computed(() => {
    return this.misAlquileres().filter((a) => this.esRecojoHoy(a)).length;
  });

  toggleSoloHoy(): void {
    const nuevo = !this.soloHoy();
    this.soloHoy.set(nuevo);
    if (nuevo) {
      this.filtroEstado.set('TODOS');
    }
    this.paginaActual.set(1);
  }

  activarFiltroHoy(): void {
    this.soloHoy.set(true);
    this.filtroEstado.set('TODOS');
    this.paginaActual.set(1);
  }

  toggleOrden(): void {
    this.ordenModo.update((m) => (m === 'INTELIGENTE' ? 'REGISTRO' : 'INTELIGENTE'));
    this.paginaActual.set(1);
  }

  readonly alquileresFiltrados = computed(() => {
    const f = this.filtroEstado();
    const hoy = this.fechaHoyStr();
    const soloHoyActivo = this.soloHoy();
    let lista = [...this.misAlquileres()];

    // Si se activa "Para Hoy", filtra las reservas programadas para partir hoy (a punto de partir)
    if (soloHoyActivo) {
      lista = lista.filter((a) => this.esRecojoHoy(a));
    }

    if (f !== 'TODOS') {
      if (f === 'PENDIENTE') {
        lista = lista.filter((a) => (a.estado?.nombreEstado || '').toUpperCase() === 'PENDIENTE');
      } else if (f === 'RESERVADO') {
        const sub = this.subfiltroReserva();
        lista = lista.filter((a) => {
          const e = (a.estado?.nombreEstado || '').toUpperCase();
          const esRes = e === 'RESERVADO' || e === 'APROBADO' || e === 'PAGADO' || e === 'CONFIRMADO' || e === 'PAGO_EN_REVISION';
          if (!esRes) return false;
          if (sub === 'PAGADAS') {
            return this.esReservaPagada(a);
          } else if (sub === 'POR_PAGAR') {
            return this.esReservaPorPagar(a);
          }
          return true;
        });
      } else if (f === 'ACTIVO') {
        lista = lista.filter((a) => {
          const e = (a.estado?.nombreEstado || '').toUpperCase();
          return e === 'ACTIVO' || e === 'EN_CURSO' || e === 'EN CURSO';
        });
      } else if (f === 'FINALIZADO') {
        const sub = this.subfiltroFinalizado();
        lista = lista.filter((a) => {
          if (!this.esFinalizadoTotal(a)) return false;
          if (sub === 'NORMAL') {
            return this.esFinalizadoNormal(a);
          } else if (sub === 'DEUDA') {
            return this.esFinalizadoConDeuda(a);
          }
          return true;
        });
      } else if (f === 'DEUDA') {
        lista = lista.filter((a) => this.esFinalizadoConDeuda(a));
      } else {
        lista = lista.filter((a) => (a.estado?.nombreEstado || '').toUpperCase() === f);
      }
    }

    if (this.ordenModo() === 'REGISTRO') {
      return lista.sort((a, b) => (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0));
    }

    // Ordenamiento Inteligente
    return lista.sort((a, b) => {
      const scoreA = this.calcularPuntajeInteligente(a, hoy);
      const scoreB = this.calcularPuntajeInteligente(b, hoy);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      // Grupo 1 o 3 (Operaciones de hoy o reservas próximas):
      // Orden cronológico de fechaInicio y horaRecojo ASC (los más próximos van primero)
      if (scoreA <= 3) {
        const fA = a.fechaInicio || '';
        const fB = b.fechaInicio || '';
        if (fA !== fB) return fA.localeCompare(fB);
        const hA = a.horaRecojo || '00:00';
        const hB = b.horaRecojo || '00:00';
        return hA.localeCompare(hB);
      }

      // Grupo 4 (Pendientes): FIFO (el primero que solicitó se atiende primero)
      if (scoreA === 4) {
        const rA = a.fechaReserva || '';
        const rB = b.fechaReserva || '';
        if (rA !== rB) return rA.localeCompare(rB);
        return (a.idAlquiler ?? 0) - (b.idAlquiler ?? 0);
      }

      // Finalizados / Histórico: los más recientes primero
      return (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0);
    });
  });

  private calcularPuntajeInteligente(alq: Alquiler, hoy: string): number {
    const est = (alq.estado?.nombreEstado || '').toUpperCase();
    const inicio = alq.fechaInicio || '';
    const fin = alq.fechaFinEstimada || '';

    // 1: Operaciones de HOY (recojo o retorno)
    if (inicio === hoy && (est === 'RESERVADO' || est === 'PAGADO' || est === 'CONFIRMADO' || est === 'ACTIVO')) {
      return 1;
    }
    if (fin === hoy && (est === 'ACTIVO' || est === 'EN_CURSO')) {
      return 1;
    }

    // 2: En ruta en curso
    if (est === 'ACTIVO' || est === 'EN_CURSO' || est === 'EN CURSO') {
      return 2;
    }

    // 3: Reservados / Pagados futuros (fechaInicio >= hoy)
    if (est === 'RESERVADO' || est === 'PAGADO' || est === 'APROBADO' || est === 'PAGO_EN_REVISION') {
      return 3;
    }

    // 4: Solicitudes pendientes de aprobación (FIFO)
    if (est === 'PENDIENTE') {
      return 4;
    }

    // 5: Otros / Finalizados
    return 5;
  }

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.alquileresFiltrados().length / this.tamanoPagina()))
  );

  readonly alquileresPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.alquileresFiltrados().slice(inicio, inicio + this.tamanoPagina());
  });

  readonly rangoInicio = computed(() =>
    this.alquileresFiltrados().length === 0 ? 0 : (this.paginaActual() - 1) * this.tamanoPagina() + 1
  );

  readonly rangoFin = computed(() =>
    Math.min(this.paginaActual() * this.tamanoPagina(), this.alquileresFiltrados().length)
  );

  cambiarFiltro(nuevo: string): void {
    this.filtroEstado.set(nuevo);
    this.soloHoy.set(false);
    this.subfiltroReserva.set('TODAS');
    this.subfiltroFinalizado.set('TODAS');
    this.paginaActual.set(1);
  }

  cambiarSubfiltroReserva(sub: 'TODAS' | 'PAGADAS' | 'POR_PAGAR'): void {
    this.subfiltroReserva.set(sub);
    this.paginaActual.set(1);
  }

  cambiarSubfiltroFinalizado(sub: 'TODAS' | 'NORMAL' | 'DEUDA'): void {
    this.subfiltroFinalizado.set(sub);
    this.paginaActual.set(1);
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) {
      this.paginaActual.update((p) => p - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.update((p) => p + 1);
    }
  }

  irAPagina(p: number): void {
    this.paginaActual.set(p);
  }

  nombreVehiculo(alq?: Alquiler | null): string {
    if (!alq?.vehiculo?.modelo) return 'Vehículo';
    const marca = alq.vehiculo.modelo.marca?.nombreMarca || '';
    const mod = alq.vehiculo.modelo.modelo || '';
    return `${marca} ${mod}`.trim() || 'Vehículo';
  }

  placaVehiculo(alq?: Alquiler | null): string {
    return alq?.vehiculo?.placa || 'Por asignar';
  }

  imagenVehiculo(alq?: Alquiler | null): string {
    return obtenerImagenVehiculo(alq?.vehiculo) || 'images/default-car.png';
  }

  formatearSede(sede?: string): string {
    const s = (sede || '').toUpperCase();
    if (s === 'AEROPUERTO') return 'Aeropuerto Internacional Jorge Chávez';
    return 'Sede Miraflores';
  }

  calcularGarantiaPorTipo(tipo?: string): number {
    const t = (tipo || '').toUpperCase();
    if (t.includes('PICKUP') || t.includes('CAMIONETA')) return 7000;
    if (t.includes('SUV')) return 5000;
    if (t.includes('SEDAN') || t.includes('SEDÁN')) return 3500;
    if (t.includes('HATCHBACK')) return 2500;
    return 3500;
  }

  calcularDias(inicioStr?: string, finStr?: string): number {
    if (!inicioStr || !finStr) return 1;
    const ini = new Date(inicioStr).getTime();
    const fin = new Date(finStr).getTime();
    const diff = Math.round((fin - ini) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }

  obtenerGarantiaAlquiler(alquiler: Alquiler): number {
    return this.calcularGarantiaPorTipo(alquiler.vehiculo?.tipo?.nombreTipo);
  }

  obtenerLiquidacion(alquiler: Alquiler): LiquidacionAlquiler {
    return obtenerLiquidacionAlquiler(alquiler);
  }

  abrirModalLiquidacion(alquiler: Alquiler): void {
    this.dialog.open(ActaLiquidacionDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      panelClass: 'modal-comprobante-dialog',
      data: {
        alquiler,
        pagado: this.esReservaPagada(alquiler)
      }
    });
  }

  cerrarModalLiquidacion(): void {
    this.alquilerSeleccionado.set(null);
  }

  descargarComprobanteDirecto(alquiler: Alquiler, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const liq = this.obtenerLiquidacion(alquiler);
    this.imprimirLiquidacion(liq, alquiler);
  }

  imprimirLiquidacion(liq: LiquidacionAlquiler, alquiler: Alquiler): void {
    const estado = (alquiler.estado?.nombreEstado || '').toUpperCase();
    const tituloDoc = estado === 'PENDIENTE'
      ? 'COMPROBANTE DE SOLICITUD DE RESERVA'
      : estado === 'RESERVADO'
      ? 'COMPROBANTE DE RESERVA APROBADA'
      : estado === 'ACTIVO'
      ? 'COMPROBANTE DE CONTRATO Y ALQUILER ACTIVO'
      : estado === 'FINALIZADO'
      ? 'COMPROBANTE OFICIAL DE LIQUIDACIÓN Y DEVOLUCIÓN'
      : 'CONSTANCIA DE RESERVA CANCELADA';

    const subtituloDoc = estado === 'PENDIENTE'
      ? 'Constancia de registro de solicitud en plataforma web Paul Car\'s'
      : estado === 'RESERVADO'
      ? 'Orden de reserva confirmada y lista para retiro en counter'
      : estado === 'ACTIVO'
      ? 'Contrato de alquiler en curso con entrega de vehículo efectuada'
      : estado === 'FINALIZADO'
      ? 'Liquidación final con inspección aprobada y garantía liberada'
      : 'Registro de solicitud anulada sin penalidad';

    const marca = alquiler.vehiculo?.modelo?.marca?.nombreMarca || '';
    const modelo = alquiler.vehiculo?.modelo?.modelo || '';
    const placa = alquiler.vehiculo?.placa || 'En asignación';
    const clienteNom = alquiler.cliente ? `${alquiler.cliente.nombres} ${alquiler.cliente.apellidos}` : 'Cliente';
    const clienteDoc = alquiler.cliente?.numeroDocumento || '—';
    const clienteTel = alquiler.cliente?.telefono || '—';
    const clienteEmail = alquiler.cliente?.email || '—';

    const w = window.open('', '_blank', 'width=880,height=960');
    if (!w) return;

    w.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Paul Car's - ${tituloDoc} ${this.formatearCodigoAlquiler(alquiler.idAlquiler)}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 13px; line-height: 1.45; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d1b3e; padding-bottom: 16px; margin-bottom: 20px; }
          .brand h1 { margin: 0; font-size: 22px; color: #0d1b3e; text-transform: uppercase; letter-spacing: 0.5px; }
          .brand p { margin: 2px 0 0; color: #64748b; font-size: 11px; }
          .doc-badge { text-align: right; }
          .doc-badge .tag { background: #0d1b3e; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; }
          .doc-badge .num { font-size: 18px; font-weight: 800; color: #0d1b3e; margin-top: 4px; }
          .doc-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
          .section { margin-bottom: 18px; }
          .section-title { font-size: 12px; font-weight: 800; color: #0d1b3e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
          .info-box p { margin: 3px 0; font-size: 12px; }
          .info-box strong { color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
          th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px 10px; font-weight: 700; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
          .total-box { background: #f8fafc; border: 2px solid #0d1b3e; border-radius: 6px; padding: 12px; margin-top: 14px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
          .total-row.final { font-size: 16px; font-weight: 800; color: #0d1b3e; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 6px; }
          .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 10px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
          .sig-line { border-top: 1px solid #94a3b8; text-align: center; padding-top: 6px; font-size: 11px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <h1>PAUL CAR'S ALQUILER DE VEHÍCULOS</h1>
            <p>RUC: 20601234567 &bull; Lima, Perú &bull; Tel: (01) 445-8890</p>
          </div>
          <div class="doc-badge">
            <div class="tag">${tituloDoc}</div>
            <div class="num">N° ALQ-${String(alquiler.idAlquiler).padStart(6, '0')}</div>
            <div class="doc-sub">${subtituloDoc}</div>
          </div>
        </div>

        <div class="section">
          <div class="grid-2">
            <div class="info-box">
              <div class="section-title">Datos del Cliente</div>
              <p><strong>Titular:</strong> ${clienteNom}</p>
              <p><strong>Documento (DNI):</strong> ${clienteDoc}</p>
              <p><strong>Teléfono:</strong> ${clienteTel}</p>
              <p><strong>Correo:</strong> ${clienteEmail}</p>
            </div>
            <div class="info-box">
              <div class="section-title">Vehículo Asignado</div>
              <p><strong>Modelo:</strong> ${marca} ${modelo}</p>
              <p><strong>Placa:</strong> ${placa}</p>
              <p><strong>Categoría:</strong> ${liq.tipoVehiculo}</p>
              <p><strong>Tarifa Diaria:</strong> S/ ${liq.tarifaDia.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="info-box">
            <div class="section-title">Detalles del Servicio</div>
            <div class="grid-2">
              <div>
                <p><strong>Sede de Recojo:</strong> ${liq.sedeRecojo}</p>
                <p><strong>Fecha y Hora de Inicio:</strong> ${alquiler.fechaInicio} &bull; ${liq.horaEntregaPactada}</p>
              </div>
              <div>
                <p><strong>Sede de Devolución:</strong> ${liq.sedeDevolucion}</p>
                <p><strong>Fecha y Hora de Devolución:</strong> ${alquiler.fechaFinEstimada} &bull; ${liq.horaDevolucionProgramada}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Desglose de Liquidación</div>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th style="text-align: center;">Cantidad</th>
                <th style="text-align: right;">Unitario</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Alquiler Base de Vehículo (${marca} ${modelo})</td>
                <td style="text-align: center;">${liq.dias} días</td>
                <td style="text-align: right;">S/ ${liq.tarifaDia.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.subtotalAlquiler.toFixed(2)}</td>
              </tr>
              ${liq.montoExtras > 0 ? `
              <tr>
                <td>Servicios Extras (${liq.extrasTexto})</td>
                <td style="text-align: center;">1</td>
                <td style="text-align: right;">S/ ${liq.montoExtras.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.montoExtras.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${liq.montoRetraso > 0 ? `
              <tr>
                <td>Cargo por Retraso en Devolución (${liq.retrasoHoras} hrs)</td>
                <td style="text-align: center;">${liq.retrasoHoras} hrs</td>
                <td style="text-align: right;">S/ ${liq.tarifaHoraRetraso.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.montoRetraso.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${liq.montoPercance > 0 ? `
              <tr>
                <td>Penalidades / Percances Observados</td>
                <td style="text-align: center;">1</td>
                <td style="text-align: right;">S/ ${liq.montoPercance.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.montoPercance.toFixed(2)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-row">
              <span>Depósito de Garantía Retenido en Counter:</span>
              <strong>S/ ${liq.depositoGarantia.toFixed(2)}</strong>
            </div>
            <div class="total-row">
              <span>Estado de la Garantía:</span>
              <strong>${liq.estadoGarantia === 'LIBERADA_TOTAL' ? 'LIBERADA 100% (Sin multas ni daños)' : liq.estadoGarantia === 'RETENIDA_PARCIAL' ? 'RETENCIÓN PARCIAL' : 'EN CUSTODIA (Se reembolsa al devolver)'}</strong>
            </div>
            <div class="total-row final">
              <span>TOTAL FACTURADO DEL ALQUILER:</span>
              <span>S/ ${liq.totalAlquiler.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-line">
            Firma del Asesor de Counter<br>
            <strong>Paul Car's Alquiler de Vehículos</strong>
          </div>
          <div class="sig-line">
            Firma y DNI del Conductor Autorizado<br>
            <strong>${clienteNom} &bull; DNI ${clienteDoc}</strong>
          </div>
        </div>

        <div class="footer">
          Documento generado electrónicamente en el Sistema Paul Car's &bull; Fecha: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    w.document.close();
  }

  confirmarCancelarSolicitud(alq: Alquiler): void {
    const data: ConfirmDialogData = {
      titulo: 'Cancelar Solicitud de Reserva',
      mensaje: `¿Estás seguro de que deseas cancelar tu solicitud de reserva para el vehículo ${this.nombreVehiculo(alq)}?`,
      textoConfirmar: 'Sí, Cancelar Solicitud',
      textoCancelar: 'Mantener Solicitud',
      tipo: 'cancelar'
    };

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '480px',
      autoFocus: false
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;
      this.alquilerService.cancelar(alq.idAlquiler!).subscribe({
        next: () => {
          this.snackBar.open('Tu solicitud de reserva ha sido cancelada.', 'Cerrar', { duration: 4000 });
          this.alquilerService.cargarMisAlquileres();
          this.vehiculoService.cargar();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'No se pudo cancelar la solicitud.', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }
}
