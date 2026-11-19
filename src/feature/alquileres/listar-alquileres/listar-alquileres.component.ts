import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  Alquiler,
  RechazoReservaRequest,
} from '../../../core/models/alquiler.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  AlquilerFormDialogComponent,
  NuevoAlquilerResultado,
} from '../alquiler-form-dialog/alquiler-form-dialog.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';

import { PagoService } from '../../../core/service/pago.service';
import { PagoDialogComponent } from '../pago-dialog/pago-dialog.component';
import { AuthService } from '../../../core/service/auth.service';
import {
  AprobarReservaDialogComponent,
  AprobarReservaResultado,
} from '../aprobar-reserva-dialog/aprobar-reserva-dialog.component';
import { RechazoReservaDialogComponent } from '../rechazo-reserva-dialog/rechazo-reserva-dialog.component';
import { CheckoutInspeccionDialogComponent } from '../checkout-inspeccion-dialog/checkout-inspeccion-dialog.component';
import { EntregaLlavesDialogComponent } from '../entrega-llaves-dialog/entrega-llaves-dialog.component';
import { EvaluarDanosDialogComponent } from '../evaluar-danos-dialog/evaluar-danos-dialog.component';
import { CobrarDeudaDialogComponent } from '../cobrar-deuda-dialog/cobrar-deuda-dialog.component';
import { ComprobanteAlquilerService } from '../../../core/service/comprobante-alquiler.service';
import { MINUTOS_ENTREGA_ANTICIPADA, entregaAunNoHabilitada, textoEntregaDesde } from '../../../core/utils/entrega.util';
import { DetalleAlquilerDialogComponent } from '../detalle-alquiler-dialog/detalle-alquiler-dialog.component';
import { DevolucionDialogComponent } from '../../../shared/components/devolucion-dialog/devolucion-dialog.component';
import { CancelarReservaDialogComponent } from '../cancelar-reserva-dialog/cancelar-reserva-dialog.component';
import { VisorPdfDialogComponent } from '../../../shared/components/visor-pdf-dialog/visor-pdf-dialog.component';
import { descargarBlob, fechaDiaMes, formatearFechaHoraCorta, formatearFechaHoraExacta } from '../../../core/utils/descarga.util';
import { LiquidacionResponse } from '../../../core/models/liquidacion.model';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import {
  etiquetaEstadoAlquiler,
  motivoRechazoLegible,
  formatearCodigoAlquiler,
  LiquidacionAlquiler,
  obtenerLiquidacionAlquiler,
} from '../../../core/utils/reglas-negocio.util';

type FiltroEstado =
  | 'TODOS'
  | 'OPERACIONES_HOY'
  | 'PENDIENTE'
  | 'RESERVADO'
  | 'ACTIVO'
  | 'FINALIZADO'
  | 'CERRADO_CON_DEUDA'
  | 'CANCELADO';

export type FiltroFecha = 'TODAS' | 'HOY' | 'ATRASADAS' | 'FECHA_ESPECIFICA';
export type SubfiltroReserva = 'TODAS' | 'PAGADAS' | 'POR_PAGAR' | 'PENDIENTES';
export type SubfiltroFinalizado = 'TODAS' | 'NORMAL' | 'DEUDA';

// Orden de la tabla: prioridad operativa, los últimos en llegar a un estado o los últimos en salir de él
export type OrdenTabla = 'PRIORIDAD' | 'LLEGADA' | 'SALIDA';

// Estados internos que forman cada grupo del filtro
const GRUPOS_ESTADO: Record<string, string[]> = {
  PENDIENTE: ['PENDIENTE'],
  RESERVADO: ['RESERVADO', 'APROBADO', 'CONFIRMADO', 'PAGADO', 'PAGO_EN_REVISION'],
  ACTIVO: ['ACTIVO', 'EN_CURSO', 'EN CURSO'],
  FINALIZADO: ['FINALIZADO', 'CERRADO_CON_DEUDA'],
  CANCELADO: ['CANCELADO', 'RECHAZADO', 'RECHAZADO_DOCUMENTACION', 'CANCELADO_SIN_STOCK']
};

@Component({
  selector: 'app-listar-alquileres',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    BackButtonComponent,
  ],
  templateUrl: './listar-alquileres.component.html',
  styleUrl: './listar-alquileres.component.css',
})
export class ListarAlquileresComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly alquilerService = inject(AlquilerService);
  private readonly pagoService = inject(PagoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');
  readonly etiquetaEstado = etiquetaEstadoAlquiler;
  readonly motivoLegible = motivoRechazoLegible;
  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;
  readonly fechaHora = formatearFechaHoraExacta;
  readonly fechaHoraCorta = formatearFechaHoraCorta;
  readonly fechaDiaMes = fechaDiaMes;

  private readonly comprobantes = inject(ComprobanteAlquilerService);

  readonly columnas = computed(() => {
    // En Finalizados la columna Acción solo aparece si hay algo por hacer (evaluar daños pendientes)
    if (this.filtroEstado() === 'FINALIZADO' && !this.alquileresFiltrados().some((a) => a.estadoDanos === 'PENDIENTE_EVALUACION' || a.estado?.nombreEstado === 'CERRADO_CON_DEUDA')) {
      return ['cliente', 'vehiculo', 'fechas', 'registro', 'estado', 'detalle', 'comprobante'];
    }
    return ['cliente', 'vehiculo', 'fechas', 'registro', 'estado', 'accion', 'detalle', 'comprobante'];
  });

  readonly busqueda = signal('');
  // Contrato recién registrado: se muestra primero en la tabla hasta que se cambie el orden o el filtro
  readonly alquilerRecienId = signal<number | null>(null);
  readonly ordenPor = signal<OrdenTabla>('PRIORIDAD');

  // El orden por llegada/salida solo tiene sentido con un estado elegido
  readonly hayEstadoElegido = computed(() => !!GRUPOS_ESTADO[this.filtroEstado()]);

  readonly textoOrden = computed(() => {
    switch (this.ordenPor()) {
      case 'LLEGADA':
        return 'Más recientes en llegar';
      case 'SALIDA':
        return 'Más recientes en salir';
      default:
        return 'Prioridad operativa';
    }
  });

  // Para cada contrato que salió del estado elegido: cuándo salió (el cambio más reciente)
  readonly salidasDelEstado = computed(() => {
    const grupo = GRUPOS_ESTADO[this.filtroEstado()];
    const mapa = new Map<number, string>();
    this.destinoSalida.clear();
    if (!grupo) return mapa;
    for (const h of this.alquilerService.historialEstados()) {
      const ant = (h.estadoAnterior || '').toUpperCase();
      const nuevo = (h.estadoNuevo || '').toUpperCase();
      if (ant && grupo.includes(ant) && !grupo.includes(nuevo)) {
        mapa.set(h.idAlquiler, h.fechaHora); // el historial viene ordenado: gana el último
        this.destinoSalida.set(h.idAlquiler, nuevo);
      }
    }
    return mapa;
  });

  cambiarOrden(orden: OrdenTabla): void {
    this.alquilerRecienId.set(null);
    this.ordenPor.set(orden);
    this.paginaActual.set(1);
  }

  // Estado al que pasó cada contrato cuando salió del estado elegido
  private readonly destinoSalida = new Map<number, string>();

  // Título de la columna: la misma columna REGISTRO cambia según el orden elegido
  get tituloRegistro(): string {
    switch (this.ordenPor()) {
      case 'LLEGADA':
        return 'LLEGÓ AL ESTADO';
      case 'SALIDA':
        return `SALIÓ DE ${this.textoBotonEstado().toUpperCase()}`;
      default:
        return 'ÚLTIMO CAMBIO';
    }
  }

  // Contenido de la columna de movimiento: fecha y hora, y a qué estado corresponde
  movimientoEstado(a: Alquiler): { fecha: string | null | undefined; detalle: string } | null {
    const orden = this.ordenPor();
    if (orden === 'LLEGADA') {
      const fecha = a.fechaUltimoEstado;
      return { fecha, detalle: '' }; // el estado ya se ve en la columna ESTADO
    }
    if (orden === 'SALIDA' && a.idAlquiler) {
      const fecha = this.salidasDelEstado().get(a.idAlquiler);
      const destino = this.destinoSalida.get(a.idAlquiler);
      // Solo se aclara a dónde pasó cuando es distinto del estado actual que ya muestra la columna ESTADO
      const etiquetaDestino = destino ? this.etiquetaNombreEstado(destino, a) : '';
      return { fecha, detalle: etiquetaDestino && etiquetaDestino !== this.etiquetaEstadoActual(a) ? `Pasó a ${etiquetaDestino}` : '' };
    }
    return null;
  }

  // Etiqueta del estado actual del contrato (distingue reservado por pagar / pagado)
  etiquetaEstadoActual(a: Alquiler): string {
    return this.etiquetaNombreEstado((a.estado?.nombreEstado || '').toUpperCase(), a);
  }

  private etiquetaNombreEstado(nombre: string, a: Alquiler): string {
    switch (nombre) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'RESERVADO':
      case 'APROBADO':
        return 'Reservado · Por pagar';
      case 'PAGADO':
      case 'CONFIRMADO':
        return 'Reservado · Pagado';
      case 'ACTIVO':
      case 'EN_CURSO':
      case 'EN CURSO':
        return 'En ruta';
      case 'FINALIZADO':
        return 'Finalizado';
      case 'CANCELADO':
      case 'RECHAZADO':
      case 'RECHAZADO_DOCUMENTACION':
      case 'CANCELADO_SIN_STOCK':
        return 'Cancelado';
      default:
        return this.etiquetaEstado(a.estado?.nombreEstado);
    }
  }
  readonly filtroEstado = signal<FiltroEstado>('TODOS');
  readonly filtroFecha = signal<FiltroFecha>('TODAS');
  readonly fechaPersonalizada = signal<string>('');
  readonly subfiltroReserva = signal<SubfiltroReserva>('TODAS');
  readonly subfiltroFinalizado = signal<SubfiltroFinalizado>('TODAS');

  readonly conteoReservasGeneral = computed(() => {
    return this.alquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return (
        e === 'RESERVADO' ||
        e === 'APROBADO' ||
        e === 'CONFIRMADO' ||
        e === 'PAGADO'
      );
    }).length;
  });

  readonly conteoEnRutaGeneral = computed(() => {
    return this.alquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return e === 'ACTIVO' || e === 'EN_CURSO' || e === 'EN CURSO';
    }).length;
  });

  readonly conteoFinalizadosGeneral = computed(() => {
    return this.alquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return this.esFinalizadoTotal(a);
    }).length;
  });

  readonly alquileresBaseFecha = computed(() => {
    const fFecha = this.filtroFecha();
    const todos = this.alquileres();
    if (fFecha === 'TODAS') return todos;

    const hoy = this.fechaHoyStr();
    const target = this.fechaPersonalizada();

    return todos.filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      if (fFecha === 'HOY') {
        const recojoHoy =
          a.fechaInicio === hoy &&
          (e === 'RESERVADO' ||
            e === 'PAGADO' ||
            e === 'CONFIRMADO' ||
            e === 'APROBADO');
        const retornoHoy =
          a.fechaFinEstimada === hoy && (e === 'ACTIVO' || e === 'EN_CURSO');
        return recojoHoy || retornoHoy;
      }
      if (fFecha === 'ATRASADAS') {
        const recojoAtrasado =
          (a.fechaInicio || '') < hoy &&
          (e === 'RESERVADO' ||
            e === 'PAGADO' ||
            e === 'CONFIRMADO' ||
            e === 'APROBADO');
        const retornoAtrasado =
          (a.fechaFinEstimada || '') < hoy &&
          (e === 'ACTIVO' || e === 'EN_CURSO');
        return recojoAtrasado || retornoAtrasado;
      }
      if (fFecha === 'FECHA_ESPECIFICA' && target) {
        return a.fechaInicio === target || a.fechaFinEstimada === target;
      }
      return true;
    });
  });

  readonly conteoReservasPagadas = computed(() => {
    return this.alquileresBaseFecha().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      const esRes =
        e === 'RESERVADO' ||
        e === 'APROBADO' ||
        e === 'CONFIRMADO' ||
        e === 'PAGADO';
      return esRes && this.esReservaPagada(a);
    }).length;
  });

  readonly conteoReservasPorPagar = computed(() => {
    return this.alquileresBaseFecha().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      const esRes =
        e === 'RESERVADO' ||
        e === 'APROBADO' ||
        e === 'CONFIRMADO' ||
        e === 'PAGADO' ||
        e === 'PAGO_EN_REVISION';
      return esRes && this.esReservaPorPagar(a);
    }).length;
  });

  readonly conteoFinalizadasTotal = computed(() => {
    return this.alquileresBaseFecha().filter((a) => this.esFinalizadoTotal(a))
      .length;
  });

  readonly conteoFinalizadasNormal = computed(() => {
    return this.alquileresBaseFecha().filter((a) => this.esFinalizadoNormal(a))
      .length;
  });

  readonly conteoFinalizadasConDeuda = computed(() => {
    return this.alquileresBaseFecha().filter((a) =>
      this.esFinalizadoConDeuda(a),
    ).length;
  });


  readonly textoBotonEstado = computed(() => {
    const est = this.filtroEstado();
    switch (est) {
      case 'PENDIENTE':
        return 'Solicitudes';
      case 'RESERVADO':
        return 'Reservas';
      case 'ACTIVO':
        return 'En ruta';
      case 'FINALIZADO':
        return 'Finalizados';
      case 'CERRADO_CON_DEUDA':
        return 'Con deuda';
      case 'CANCELADO':
        return 'Cancelados';
      default:
        return 'Filtrar por estado';
    }
  });

  readonly esFiltroPersonalizado = computed(() => {
    const est = this.filtroEstado();
    return est !== 'TODOS' && est !== 'OPERACIONES_HOY';
  });

  readonly alquileres = this.alquilerService.alquileres;
  readonly pagos = this.pagoService.pagos;

  // ── Detalle de una reserva cancelada o rechazada (motivo y, si hubo pago, devolución) ──

  verDevolucion(a: Alquiler): void {
    const ref = this.dialog.open(DevolucionDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      data: { alquiler: a },
      autoFocus: false
    });
    ref.afterClosed().subscribe((res?: { accion?: string }) => {
      if (res?.accion === 'ACTUALIZAR') {
        this.alquilerService.cargar();
        this.snackBar.open('Esa reserva ya no está disponible. Se actualizó la lista.', 'Cerrar', { duration: 6000 });
      }
    });
  }

  // Se programa una recarga justo a la hora en que vence el plazo de pago más cercano: la reserva se cancela y sale al instante
  private temporizadorVencimiento: ReturnType<typeof setTimeout> | null = null;
  private readonly programarVencimiento = effect(() => {
    const ahora = Date.now();
    const proximos = this.alquileres()
      .map((a) => (a.fechaLimitePago ? new Date(a.fechaLimitePago).getTime() : NaN))
      .filter((t) => !isNaN(t) && t > ahora - 1000);
    if (this.temporizadorVencimiento) clearTimeout(this.temporizadorVencimiento);
    this.temporizadorVencimiento = null;
    if (proximos.length === 0) return;
    const espera = Math.max(Math.min(...proximos) - ahora + 200, 200);
    // setTimeout no admite esperas mayores a ~24 días; la recarga cada 30 s cubre los plazos lejanos
    if (espera > 2_000_000_000) return;
    this.temporizadorVencimiento = setTimeout(() => this.alquilerService.cargar(), espera);
  });

  fechaHoyStr(): string {
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  }

  fechaHoyLegible(): string {
    const now = new Date();
    const d = now.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      timeZone: 'America/Lima',
    });
    return d.replace('.', '');
  }

  esHoy(fecha?: string): boolean {
    if (!fecha) return false;
    return fecha === this.fechaHoyStr();
  }

  // La entrega se habilita 30 minutos antes de la hora pactada
  entregaBloqueada(a: Alquiler): boolean {
    return entregaAunNoHabilitada(a);
  }

  esFechaFutura(fecha?: string): boolean {
    if (!fecha) return false;
    return fecha > this.fechaHoyStr();
  }

  // KPIs inteligentes del asesor
  readonly entregasHoy = computed(() => {
    const hoy = this.fechaHoyStr();
    return this.alquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return (
        a.fechaInicio === hoy &&
        (e === 'RESERVADO' ||
          e === 'PAGADO' ||
          e === 'CONFIRMADO' ||
          e === 'APROBADO')
      );
    });
  });

  readonly devolucionesHoy = computed(() => {
    const hoy = this.fechaHoyStr();
    return this.alquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      return a.fechaFinEstimada === hoy && (e === 'ACTIVO' || e === 'EN_CURSO');
    });
  });

  readonly solicitudesPendientes = computed(() => {
    return this.alquileres().filter(
      (a) => (a.estado?.nombreEstado || '').toUpperCase() === 'PENDIENTE',
    );
  });

  readonly conteoOperacionesHoy = computed(() => {
    return this.entregasHoy().length + this.devolucionesHoy().length;
  });

  readonly operacionesAtrasadas = computed(() => {
    const hoy = this.fechaHoyStr();
    return this.alquileres().filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      const recojoAtrasado =
        (a.fechaInicio || '') < hoy &&
        (e === 'RESERVADO' ||
          e === 'PAGADO' ||
          e === 'CONFIRMADO' ||
          e === 'APROBADO');
      const retornoAtrasado =
        (a.fechaFinEstimada || '') < hoy &&
        (e === 'ACTIVO' || e === 'EN_CURSO');
      return recojoAtrasado || retornoAtrasado;
    });
  });

  seleccionarFechaFiltro(tipo: FiltroFecha): void {
    this.filtroFecha.set(tipo);
    this.filtroEstado.set('TODOS');
    this.paginaActual.set(1);
  }

  onFechaCalendarioChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.fechaPersonalizada.set(val);
      this.filtroFecha.set('FECHA_ESPECIFICA');
      this.filtroEstado.set('TODOS');
      this.paginaActual.set(1);
    }
  }

  readonly labelFiltroFecha = computed(() => {
    const f = this.filtroFecha();
    if (f === 'HOY') return `Para Hoy (${this.fechaHoyLegible()})`;
    if (f === 'ATRASADAS')
      return `Atrasados (${this.operacionesAtrasadas().length})`;
    if (f === 'FECHA_ESPECIFICA' && this.fechaPersonalizada()) {
      const partes = this.fechaPersonalizada().split('-');
      if (partes.length === 3) {
        const fechaObj = new Date(
          Number(partes[0]),
          Number(partes[1]) - 1,
          Number(partes[2]),
        );
        const dStr = fechaObj
          .toLocaleDateString('es-PE', {
            day: '2-digit',
            month: 'short',
            timeZone: 'America/Lima',
          })
          .replace('.', '');
        return `Fecha: ${dStr}`;
      }
      return this.fechaPersonalizada();
    }
    return `Para Hoy (${this.fechaHoyLegible()})`;
  });

  esRecojoHoy(alq?: Alquiler | null): boolean {
    if (!alq || !alq.fechaInicio) return false;
    const hoy = this.fechaHoyStr();
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    const esReservaPorSalir =
      e === 'RESERVADO' ||
      e === 'PAGADO' ||
      e === 'CONFIRMADO' ||
      e === 'APROBADO';
    return alq.fechaInicio === hoy && esReservaPorSalir;
  }

  conteoEstado(est: FiltroEstado): number {
    const base = this.alquileresBaseFecha();
    if (est === 'TODOS') return base.length;
    if (est === 'OPERACIONES_HOY') return this.conteoOperacionesHoy();
    return base.filter((a) => {
      const e = (a.estado?.nombreEstado || '').toUpperCase();
      if (est === 'PENDIENTE') return e === 'PENDIENTE';
      if (est === 'RESERVADO')
        return (
          e === 'RESERVADO' ||
          e === 'APROBADO' ||
          e === 'CONFIRMADO' ||
          e === 'PAGADO'
        );
      if (est === 'ACTIVO')
        return e === 'ACTIVO' || e === 'EN_CURSO' || e === 'EN CURSO';
      if (est === 'FINALIZADO') return this.esFinalizadoTotal(a);
      if (est === 'CERRADO_CON_DEUDA') return e === 'CERRADO_CON_DEUDA';
      if (est === 'CANCELADO') return e === 'CANCELADO' || e === 'RECHAZADO' || e === 'RECHAZADO_DOCUMENTACION' || e === 'CANCELADO_SIN_STOCK';
      return false;
    }).length;
  }

  readonly alquileresFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();
    const hoy = this.fechaHoyStr();
    const orden = this.ordenPor();
    const salidas = orden === 'SALIDA' && GRUPOS_ESTADO[estado] ? this.salidasDelEstado() : null;

    return this.alquileresBaseFecha()
      .filter((a) => {
        const nombreCliente = `${a.cliente?.nombres ?? ''} ${a.cliente?.apellidos ?? ''}`;
        const nombreVehiculo = `${a.vehiculo?.modelo?.marca?.nombreMarca ?? ''} ${a.vehiculo?.modelo?.modelo ?? ''}`;
        const placa = a.vehiculo?.placa || '';
        const idStr = String(a.idAlquiler || '');
        const refStr = a.idAlquiler
          ? `alq-${String(a.idAlquiler).padStart(6, '0')}`
          : '';
        const documento = a.cliente?.numeroDocumento ?? '';
        const coincideTexto =
          !texto ||
          `${nombreCliente} ${documento} ${nombreVehiculo} ${placa} ${idStr} ${refStr}`
            .toLowerCase()
            .includes(texto);

        const e = (a.estado?.nombreEstado || '').toUpperCase();

        let coincideEstado = true;
        if (estado === 'OPERACIONES_HOY' || estado === 'TODOS') {
          coincideEstado = true;
        } else if (estado === 'PENDIENTE') {
          coincideEstado = e === 'PENDIENTE';
        } else if (estado === 'RESERVADO') {
          const esRes =
            e === 'RESERVADO' ||
            e === 'APROBADO' ||
            e === 'CONFIRMADO' ||
            e === 'PAGADO' ||
            e === 'PAGO_EN_REVISION';
          if (!esRes) {
            coincideEstado = false;
          } else {
            const esPagado = this.esReservaPagada(a);
            const sub = this.subfiltroReserva();
            if (sub === 'PENDIENTES' || sub === 'POR_PAGAR') {
              coincideEstado = !esPagado;
            } else if (sub === 'PAGADAS') {
              coincideEstado = esPagado;
            } else {
              coincideEstado = true;
            }
          }
        } else if (estado === 'ACTIVO') {
          coincideEstado =
            e === 'ACTIVO' || e === 'EN_CURSO' || e === 'EN CURSO';
        } else if (estado === 'FINALIZADO') {
          if (!this.esFinalizadoTotal(a)) {
            coincideEstado = false;
          } else {
            const sub = this.subfiltroFinalizado();
            if (sub === 'NORMAL') {
              coincideEstado = this.esFinalizadoNormal(a);
            } else if (sub === 'DEUDA') {
              coincideEstado = this.esFinalizadoConDeuda(a);
            } else {
              coincideEstado = true;
            }
          }
        } else if (estado === 'CERRADO_CON_DEUDA') {
          coincideEstado = e === 'CERRADO_CON_DEUDA';
        } else if (estado === 'CANCELADO') {
          coincideEstado = e === 'CANCELADO' || e === 'RECHAZADO' || e === 'RECHAZADO_DOCUMENTACION' || e === 'CANCELADO_SIN_STOCK';
        } else if (estado !== 'TODOS') {
          coincideEstado = e === estado;
        }

        // En "más recientes en salir" se muestran los contratos que ya abandonaron el estado elegido
        if (orden === 'SALIDA' && salidas) {
          coincideEstado = !!a.idAlquiler && salidas.has(a.idAlquiler);
        }

        return coincideTexto && coincideEstado;
      })
      .sort((a, b) => {
        const nuevoId = this.alquilerRecienId();
        if (nuevoId !== null) {
          if (a.idAlquiler === nuevoId) return -1;
          if (b.idAlquiler === nuevoId) return 1;
        }
        if (orden === 'LLEGADA') {
          return (b.fechaUltimoEstado || '').localeCompare(a.fechaUltimoEstado || '');
        }
        if (orden === 'SALIDA' && salidas) {
          return (salidas.get(b.idAlquiler ?? 0) || '').localeCompare(salidas.get(a.idAlquiler ?? 0) || '');
        }
        // 2. Criterio AUTOMATICO (Prioridad operativa inteligente según el estado actual)
        if (estado === 'PENDIENTE') {
          // Solicitudes: las más antiguas primero para atender al cliente en orden de espera
          const rA = a.fechaReserva || '';
          const rB = b.fechaReserva || '';
          if (rA && rB && rA !== rB) return rA.localeCompare(rB);
          return (a.idAlquiler ?? 0) - (b.idAlquiler ?? 0);
        }

        if (estado === 'RESERVADO') {
          // Reservas y Pagados: los más próximos a salir primero (para cobrar en counter o entregar llaves)
          const fA = a.fechaInicio || '';
          const fB = b.fechaInicio || '';
          if (fA !== fB) return fA.localeCompare(fB);
          const hA = a.horaRecojo || '00:00';
          const hB = b.horaRecojo || '00:00';
          if (hA !== hB) return hA.localeCompare(hB);
          return (a.idAlquiler ?? 0) - (b.idAlquiler ?? 0);
        }

        if (estado === 'ACTIVO') {
          // En ruta: vehículos más próximos a vencer o retornar primero (para preparar check-out e inspección)
          const fA = a.fechaFinEstimada || '';
          const fB = b.fechaFinEstimada || '';
          if (fA !== fB) return fA.localeCompare(fB);
          const hA = a.horaDevolucion || '23:59';
          const hB = b.horaDevolucion || '23:59';
          if (hA !== hB) return hA.localeCompare(hB);
          return (a.idAlquiler ?? 0) - (b.idAlquiler ?? 0);
        }

        if (
          estado === 'FINALIZADO' ||
          estado === 'CANCELADO' ||
          estado === 'CERRADO_CON_DEUDA'
        ) {
          // Finalizados, Cancelados o Con Deuda: los más recientes primero
          return (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0);
        }

        // Para 'TODOS' u 'OPERACIONES_HOY':
        const scoreA = this.calcularPuntajeInteligente(a, hoy);
        const scoreB = this.calcularPuntajeInteligente(b, hoy);
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }

        if (scoreA === 1) {
          const hA = a.horaRecojo || a.horaDevolucion || '00:00';
          const hB = b.horaRecojo || b.horaDevolucion || '00:00';
          return hA.localeCompare(hB);
        }

        if (scoreA <= 3) {
          const fA = a.fechaInicio || '';
          const fB = b.fechaInicio || '';
          if (fA !== fB) return fA.localeCompare(fB);
          const hA = a.horaRecojo || '00:00';
          const hB = b.horaRecojo || '00:00';
          return hA.localeCompare(hB);
        }

        if (scoreA === 4) {
          return (a.idAlquiler ?? 0) - (b.idAlquiler ?? 0);
        }

        return (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0);
      });
  });

  private calcularPuntajeInteligente(alq: Alquiler, hoy: string): number {
    const est = (alq.estado?.nombreEstado || '').toUpperCase();
    const inicio = alq.fechaInicio || '';
    const fin = alq.fechaFinEstimada || '';

    // 1: Operaciones de HOY (recojo o retorno)
    if (
      inicio === hoy &&
      (est === 'RESERVADO' ||
        est === 'PAGADO' ||
        est === 'CONFIRMADO' ||
        est === 'APROBADO')
    ) {
      return 1;
    }
    if (fin === hoy && (est === 'ACTIVO' || est === 'EN_CURSO')) {
      return 1;
    }

    // 2: En ruta activos en curso
    if (est === 'ACTIVO' || est === 'EN_CURSO' || est === 'EN CURSO') {
      return 2;
    }

    // 3: Reservados / Pagados futuros
    if (est === 'RESERVADO' || est === 'PAGADO' || est === 'APROBADO') {
      return 3;
    }

    // 4: Solicitudes pendientes (FIFO)
    if (est === 'PENDIENTE') {
      return 4;
    }

    // 5: Otros / Finalizados
    return 5;
  }

  readonly paginaActual = signal(1);
  readonly tamanoPagina = signal(6);

  readonly totalPaginas = computed(() => {
    const total = this.alquileresFiltrados().length;
    return Math.max(1, Math.ceil(total / this.tamanoPagina()));
  });

  readonly alquileresPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.alquileresFiltrados().slice(
      inicio,
      inicio + this.tamanoPagina(),
    );
  });

  readonly rangoInicio = computed(() => {
    if (this.alquileresFiltrados().length === 0) return 0;
    return (this.paginaActual() - 1) * this.tamanoPagina() + 1;
  });

  readonly rangoFin = computed(() => {
    return Math.min(
      this.paginaActual() * this.tamanoPagina(),
      this.alquileresFiltrados().length,
    );
  });

  readonly paginasArray = computed(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) {
      this.paginaActual.set(p);
    }
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

  ngOnInit(): void {
    this.alquilerService.cargar();
    this.pagoService.cargar();

    // La lista se mantiene al día sola (ver ActualizacionEnVivoService); aquí solo se limpia el aviso de vencimiento
    this.destroyRef.onDestroy(() => {
      if (this.temporizadorVencimiento) clearTimeout(this.temporizadorVencimiento);
    });

    // Redirección desde la campana: ?reservaId=25&accion=aprobar | checkout
    this.route.queryParamMap.subscribe((params) => {
      const id = Number(params.get('reservaId'));
      if (!id) return;
      const accion = params.get('accion');
      this.alquilerService.obtenerPorId(id).subscribe({
        next: (alquiler) => {
          const estado = alquiler.estado?.nombreEstado;
          if (accion === 'checkout' && estado === 'ACTIVO') {
            this.abrirCheckout(alquiler);
          } else if (estado === 'PENDIENTE') {
            this.aprobar(alquiler);
          } else {
            this.snackBar.open(
              `El alquiler ${this.formatearCodigoAlquiler(id)} ya está en estado ${etiquetaEstadoAlquiler(estado)}.`,
              'Cerrar',
            );
          }
          // Se limpia la URL para que al refrescar no se vuelva a abrir el modal
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
        },
        error: () =>
          this.snackBar.open(
            `No se encontró el alquiler ${this.formatearCodigoAlquiler(id)}.`,
            'Cerrar',
          ),
      });
    });
  }

  // Pagos del contrato (sin contar los de liquidación del check-out)
  tienePago(idAlquiler?: number): boolean {
    if (!idAlquiler) return false;
    return this.pagos().some(
      (p) =>
        p.alquiler?.idAlquiler === idAlquiler && p.tipoPago !== 'LIQUIDACION',
    );
  }

  totalPagado(idAlquiler?: number): number {
    if (!idAlquiler) return 0;
    return this.pagos()
      .filter(
        (p) =>
          p.alquiler?.idAlquiler === idAlquiler && p.tipoPago !== 'LIQUIDACION',
      )
      .reduce((suma, p) => suma + Number(p.montoTotal), 0);
  }

  abrirPago(alquiler: Alquiler, modo: 'ALQUILER' | 'DEUDA' = 'ALQUILER'): void {
    const ref = this.dialog.open(PagoDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      data: { alquiler, modo },
    });

    ref.afterClosed().subscribe((res) => {
      if (res?.exito) {
        this.pagoService.cargar();
        this.alquilerService.cargar();

        this.snackBar.open('Pago registrado correctamente.', 'Cerrar', { duration: 4000 });
      }
    });
  }

  // Detalle de la reserva: cancelada/rechazada → motivo y devolución; el resto → ficha completa con su PDF
  verDetalle(alquiler: Alquiler): void {
    const est = (alquiler.estado?.nombreEstado || '').toUpperCase();
    if (['CANCELADO', 'RECHAZADO', 'RECHAZADO_DOCUMENTACION', 'CANCELADO_SIN_STOCK'].includes(est)) {
      this.verDevolucion(alquiler);
      return;
    }
    this.abrirFicha(alquiler);
  }

  tieneComprobante(a: Alquiler): boolean {
    return this.comprobantes.tieneComprobante(a, this.esReservaPagada(a));
  }

  verComprobante(a: Alquiler): void {
    this.comprobantes.abrir(a);
  }

  private abrirFicha(alquiler: Alquiler): void {
    this.dialog.open(DetalleAlquilerDialogComponent, {
      // El administrador ve el detalle completo (más ancho); el asesor, una vista más corta
      width: this.esAdmin() ? '960px' : '720px',
      maxWidth: '96vw',
      data: { alquiler },
      autoFocus: false
    });
  }

  descargarRecibo(idPago: number): void {
    this.pagoService.descargarRecibo(idPago).subscribe({
      next: (blob) => descargarBlob(blob, `REC-${String(idPago).padStart(6, '0')}.pdf`),
      error: () => this.snackBar.open('No se pudo descargar el recibo.', 'Cerrar', { duration: 5000 }),
    });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  filtrarPorEstado(estado: FiltroEstado): void {
    if (
      estado === 'TODOS' &&
      this.filtroEstado() === 'TODOS' &&
      this.filtroFecha() !== 'TODAS'
    ) {
      this.filtroFecha.set('TODAS');
    }
    this.alquilerRecienId.set(null);
    this.filtroEstado.set(estado);
    this.subfiltroReserva.set('TODAS');
    this.subfiltroFinalizado.set('TODAS');
    if (!GRUPOS_ESTADO[estado] && this.ordenPor() === 'SALIDA') {
      this.ordenPor.set('PRIORIDAD');
    }
    this.paginaActual.set(1);
  }

  cambiarSubfiltroFinalizado(sub: SubfiltroFinalizado): void {
    this.subfiltroFinalizado.set(sub);
    this.paginaActual.set(1);
  }

  cambiarSubfiltroReserva(sub: SubfiltroReserva): void {
    this.subfiltroReserva.set(sub);
    this.paginaActual.set(1);
  }

  // Muestra solo el primer nombre y el primer apellido del cliente
  nombreCorto(cliente?: { nombres?: string | null; apellidos?: string | null } | null): string {
    const primerNombre = (cliente?.nombres ?? '').trim().split(/\s+/)[0] ?? '';
    const primerApellido = (cliente?.apellidos ?? '').trim().split(/\s+/)[0] ?? '';
    return `${primerNombre} ${primerApellido}`.trim();
  }

  // Modal "Nuevo Alquiler" en counter (con extras)
  abrirNuevo(): void {
    const ref = this.dialog.open(AlquilerFormDialogComponent, {
      width: '660px',
      maxWidth: '96vw',
    });

    ref
      .afterClosed()
      .subscribe((resultado: NuevoAlquilerResultado | undefined) => {
        if (!resultado) return;

        this.alquilerService.crearEnCounter(resultado).subscribe({
          next: (nuevo) => {
            // Que el contrato recién hecho se vea de inmediato: sin filtros y en la primera fila
            this.busqueda.set('');
            this.filtroFecha.set('TODAS');
            this.filtroEstado.set('TODOS');
            this.subfiltroReserva.set('TODAS');
            this.subfiltroFinalizado.set('TODAS');
            this.alquilerRecienId.set(nuevo?.idAlquiler ?? null);
            this.paginaActual.set(1);
            this.alquilerService.cargar();
            this.snackBar.open('Alquiler registrado.', 'Cerrar', { duration: 4000 });
          },
          error: (err) => this.mostrarError(err, 'registrar el alquiler'),
        });
      });
  }

  // Check-out: inspección física, liquidación de daños y cierre del contrato
  // El administrador evalúa los daños nuevos y se liquida la garantía
  evaluarDanos(alquiler: Alquiler): void {
    const ref = this.dialog.open(EvaluarDanosDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      data: { alquiler },
      autoFocus: false,
    });
    ref.afterClosed().subscribe((hecho?: boolean) => {
      if (!hecho) return;
      this.alquilerService.cargar();
      this.pagoService.cargar();
      this.snackBar.open('Evaluación registrada correctamente.', 'Cerrar', { duration: 4000 });
    });
  }

  // Cobro de la deuda que superó la garantía
  cobrarDeuda(alquiler: Alquiler): void {
    const ref = this.dialog.open(CobrarDeudaDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      data: { alquiler },
      autoFocus: false,
    });
    ref.afterClosed().subscribe((hecho?: boolean) => {
      if (!hecho) return;
      this.alquilerService.cargar();
      this.pagoService.cargar();
      this.snackBar.open('Cobro registrado correctamente.', 'Cerrar', { duration: 4000 });
    });
  }

  abrirCheckout(alquiler: Alquiler): void {
    const ref = this.dialog.open(CheckoutInspeccionDialogComponent, {
      width: '500px',
      maxWidth: '96vw',
      data: { alquiler },
      autoFocus: false,
    });

    ref.afterClosed().subscribe((acta: LiquidacionResponse | undefined) => {
      if (!acta) return;
      this.pagoService.cargar();
      this.alquilerService.cargar();
      // Solo cambia el estado del contrato: se avisa y se pasa a la tabla de finalizados (sin abrir el detalle)
      this.filtrarPorEstado('FINALIZADO');
      this.alquilerRecienId.set(alquiler.idAlquiler ?? null); // primero en Finalizados
      this.snackBar.open('Recepción registrada. El contrato quedó finalizado.', 'Cerrar', { duration: 4000 });
    });
  }

  cancelar(alquiler: Alquiler): void {
    const data: ConfirmDialogData = {
      titulo: 'Cancelar Contrato de Alquiler',
      mensaje: `¿Seguro que deseas anular el contrato de alquiler de ${alquiler.cliente?.nombres} ${alquiler.cliente?.apellidos} para el vehículo ${alquiler.vehiculo?.modelo?.marca?.nombreMarca} ${alquiler.vehiculo?.modelo?.modelo}? El alquiler quedará registrado como CANCELADO.`,
      textoConfirmar: 'Sí, Cancelar Alquiler',
      textoCancelar: 'Mantener Alquiler',
      tipo: 'cancelar',
    };

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '480px',
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.alquilerService.cancelar(alquiler.idAlquiler!).subscribe({
        next: () => {
          this.alquilerService.cargar();
          this.snackBar.open('Contrato cancelado correctamente.', 'Cerrar', { duration: 4000 });
        },
        error: (err) => this.mostrarError(err, 'cancelar el alquiler'),
      });
    });
  }

  // Ficha ejecutiva de aprobación (Cliente / Vehículo / Tarifario)
  aprobar(alquiler: Alquiler): void {
    const historialCliente = this.alquileres().filter(
      (a) => a.cliente?.idCliente === alquiler.cliente?.idCliente,
    );
    const ref = this.dialog.open(AprobarReservaDialogComponent, {
      width: '1060px',
      maxWidth: '96vw',
      data: { alquiler, historialCliente },
    });

    ref.afterClosed().subscribe((resultado: AprobarReservaResultado) => {
      if (resultado === 'APROBAR') {
        this.alquilerService.aprobar(alquiler.idAlquiler!).subscribe({
          next: () => {
            this.alquilerService.cargar();
            this.snackBar.open('Reserva aprobada correctamente.', 'Cerrar', { duration: 4000 });
          },
          error: (err) => this.mostrarError(err, 'aprobar la reserva'),
        });
      } else if (resultado === 'RECHAZAR') {
        this.rechazar(alquiler);
      }
    });
  }

  // Cancelar una reserva ya aprobada (con política de devolución)
  cancelarReserva(alquiler: Alquiler): void {
    const ref = this.dialog.open(CancelarReservaDialogComponent, {
      width: '640px',
      maxWidth: '96vw',
      data: { alquiler },
      autoFocus: false,
    });
    ref.afterClosed().subscribe((res?: { accion: string; mensaje: string }) => {
      if (!res) return;
      this.alquilerService.cargar();
      this.pagoService.cargar();
      // Mensaje simple; solo se conserva el texto del sistema cuando hay un aviso que atender
      const detalle = res.accion === 'CANCELADA' && !res.mensaje.includes('Ojo') ? 'Reserva cancelada correctamente.' : res.mensaje;
      this.snackBar.open(detalle, 'Cerrar', { duration: 4000 });
    });
  }

  // Rechazo formal con causal justificada y correo al cliente
  rechazar(alquiler: Alquiler): void {
    const ref = this.dialog.open(RechazoReservaDialogComponent, {
      width: '620px',
      maxWidth: '96vw',
      data: {
        alquiler,
        tuvoAlquileres: this.alquileres().some(
          (o) => o.idAlquiler !== alquiler.idAlquiler && o.cliente?.idCliente === alquiler.cliente?.idCliente
            && ['RESERVADO', 'PAGADO', 'CONFIRMADO', 'ACTIVO', 'FINALIZADO', 'CERRADO_CON_DEUDA', 'CANCELADO']
              .includes((o.estado?.nombreEstado || '').toUpperCase())
        ),
      },
      autoFocus: false,
    });

    ref
      .afterClosed()
      .subscribe((request: RechazoReservaRequest | undefined) => {
        if (!request) return;
        this.alquilerService.rechazar(alquiler.idAlquiler!, request).subscribe({
          next: () => {
            this.alquilerService.cargar();
            this.snackBar.open('Reserva rechazada correctamente.', 'Cerrar', { duration: 4000 });
          },
          error: (err) => this.mostrarError(err, 'rechazar la reserva'),
        });
      });
  }

  // Entrega de llaves en counter: acta con verificación de documentos y conformidad del vehículo

  entregarLlaves(alquiler: Alquiler): void {
    if (entregaAunNoHabilitada(alquiler)) {
      this.snackBar.open(
        `Todavía no se puede entregar: la entrega se habilita el ${textoEntregaDesde(alquiler)} (${MINUTOS_ENTREGA_ANTICIPADA} minutos antes de la hora pactada).`,
        'Entendido',
        { duration: 7000 },
      );
      return;
    }

    const ref = this.dialog.open(EntregaLlavesDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      data: { alquiler },
      autoFocus: false,
    });

    ref.afterClosed().subscribe((entregado) => {
      if (entregado) {
        this.alquilerService.cargar();
        this.filtrarPorEstado('ACTIVO');
        this.alquilerRecienId.set(alquiler.idAlquiler ?? null); // primero en la tabla de En ruta
        this.snackBar.open('Llaves entregadas. El contrato quedó activo (en ruta).', 'Cerrar', { duration: 4000 });
      }
    });
  }

  claseEstado(nombreEstado: string | undefined): string {
    switch (nombreEstado) {
      case 'PENDIENTE':
        return 'estado-pendiente';
      case 'ACTIVO':
        return 'estado-activo';
      case 'RESERVADO':
      case 'PAGADO':
      case 'CONFIRMADO':
      case 'APROBADO':
        return 'estado-reservado';
      case 'PAGO_EN_REVISION':
        return 'estado-revision';
      case 'FINALIZADO':
        return 'estado-finalizado';
      case 'CERRADO_CON_DEUDA':
        return 'estado-deuda';
      default:
        return 'estado-cancelado';
    }
  }

  private mostrarError(err: any, accion: string): void {
    const mensaje =
      err?.error?.message || err?.error || `No se pudo ${accion}.`;
    this.snackBar.open(
      typeof mensaje === 'string' ? mensaje : `No se pudo ${accion}.`,
      'Cerrar',
      { duration: 5000 },
    );
  }

  iconoPorTipo(nombreTipo?: string): string {
    return 'directions_car';
  }

  colorFondo(color?: string): string {
    return '#f1f5f9';
  }

  esReservaPagada(alq: Alquiler): boolean {
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    if (e === 'PAGADO' || e === 'CONFIRMADO') return true;
    if (alq.idAlquiler) {
      return this.pagos().some(
        (p) =>
          p.alquiler?.idAlquiler === alq.idAlquiler &&
          p.tipoPago !== 'LIQUIDACION',
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

  nombreVehiculo(alq?: Alquiler | null): string {
    if (!alq?.vehiculo?.modelo) return 'Vehículo';
    const marca = alq.vehiculo.modelo.marca?.nombreMarca || '';
    const mod = alq.vehiculo.modelo.modelo || '';
    return `${marca} ${mod}`.trim() || 'Vehículo';
  }

  imagenVehiculo(alq?: Alquiler | null): string {
    return obtenerImagenVehiculo(alq?.vehiculo) || 'images/default-car.png';
  }

  obtenerLiquidacion(alquiler: Alquiler): LiquidacionAlquiler {
    return obtenerLiquidacionAlquiler(alquiler);
  }
}

