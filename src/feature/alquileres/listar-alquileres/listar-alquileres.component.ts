import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { ActaLiquidacionDialogComponent } from '../acta-liquidacion-dialog/acta-liquidacion-dialog.component';
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

  readonly columnas = computed(() => {
    if (this.filtroEstado() === 'FINALIZADO') {
      return ['cliente', 'vehiculo', 'fechas', 'estado', 'comprobante'];
    }
    return ['cliente', 'vehiculo', 'fechas', 'estado', 'accion', 'comprobante'];
  });

  readonly busqueda = signal('');
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
      if (est === 'CANCELADO') return e === 'CANCELADO' || e === 'RECHAZADO';
      return false;
    }).length;
  }

  readonly alquileresFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();
    const hoy = this.fechaHoyStr();

    return this.alquileresBaseFecha()
      .filter((a) => {
        const nombreCliente = `${a.cliente?.nombres ?? ''} ${a.cliente?.apellidos ?? ''}`;
        const nombreVehiculo = `${a.vehiculo?.modelo?.marca?.nombreMarca ?? ''} ${a.vehiculo?.modelo?.modelo ?? ''}`;
        const placa = a.vehiculo?.placa || '';
        const idStr = String(a.idAlquiler || '');
        const refStr = a.idAlquiler
          ? `alq-${String(a.idAlquiler).padStart(6, '0')}`
          : '';
        const coincideTexto =
          !texto ||
          `${nombreCliente} ${nombreVehiculo} ${placa} ${idStr} ${refStr}`
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
          coincideEstado = e === 'CANCELADO' || e === 'RECHAZADO';
        } else if (estado !== 'TODOS') {
          coincideEstado = e === estado;
        }

        return coincideTexto && coincideEstado;
      })
      .sort((a, b) => {
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
        const vuelto =
          Number(res.vuelto ?? 0) > 0
            ? ` Vuelto: S/ ${Number(res.vuelto).toFixed(2)}.`
            : '';
        
        this.pagoService.cargar();
        this.alquilerService.cargar();
      }
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
    this.filtroEstado.set(estado);
    this.subfiltroReserva.set('TODAS');
    this.subfiltroFinalizado.set('TODAS');
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
          next: () => {
            this.paginaActual.set(1);
            this.alquilerService.cargar();
          },
          error: (err) => this.mostrarError(err, 'registrar el alquiler'),
        });
      });
  }

  // Check-out: inspección física, liquidación de daños y cierre del contrato
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
      const alquilerActualizado: Alquiler = {
        ...alquiler,
        estado: {
          ...alquiler.estado,
          nombreEstado: acta.estadoAlquiler || 'FINALIZADO',
        },
        fechaCheckout: acta.fechaCheckout || new Date().toISOString(),
        fechaFinReal: acta.fechaCheckout || new Date().toISOString(),
        garantiaRetenida: acta.garantiaRetenida,
        garantiaLiberada: acta.garantiaLiberada,
      };
      this.verActa(acta, alquilerActualizado);
    });
  }

  verActa(acta?: LiquidacionResponse, alquiler?: Alquiler): void {
    this.dialog.open(ActaLiquidacionDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      panelClass: 'modal-comprobante-dialog',
      data: { acta, alquiler, pagado: alquiler ? this.esReservaPagada(alquiler) : true },
    });
  }

  // Consulta del comprobante oficial de liquidación (auditoría / recepción)
  consultarActa(alquiler: Alquiler): void {
    if (alquiler.fechaCheckout) {
      this.alquilerService.obtenerActa(alquiler.idAlquiler!).subscribe({
        next: (acta) => this.verActa(acta, alquiler),
        error: () => this.verActa(undefined, alquiler),
      });
    } else {
      this.verActa(undefined, alquiler);
    }
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
        next: () => this.alquilerService.cargar(),
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
          next: () => this.alquilerService.cargar(),
          error: (err) => this.mostrarError(err, 'aprobar la reserva'),
        });
      } else if (resultado === 'RECHAZAR') {
        this.rechazar(alquiler);
      }
    });
  }

  // Rechazo formal con causal justificada y correo al cliente
  rechazar(alquiler: Alquiler): void {
    const ref = this.dialog.open(RechazoReservaDialogComponent, {
      width: '620px',
      maxWidth: '96vw',
      data: { alquiler },
      autoFocus: false,
    });

    ref
      .afterClosed()
      .subscribe((request: RechazoReservaRequest | undefined) => {
        if (!request) return;
        this.alquilerService.rechazar(alquiler.idAlquiler!, request).subscribe({
          next: () => this.alquilerService.cargar(),
          error: (err) => this.mostrarError(err, 'rechazar la reserva'),
        });
      });
  }

  // Entrega rápida de llaves en counter para reservas ya pagadas

  entregarLlaves(alquiler: Alquiler): void {
    if (this.esFechaFutura(alquiler.fechaInicio)) {
      const hora = alquiler.horaRecojo
        ? ` a las ${alquiler.horaRecojo} hrs`
        : '';
      this.snackBar.open(
        `Operación bloqueada: No es posible entregar llaves ni activar ruta antes de la fecha pactada. Fecha programada de recojo: ${alquiler.fechaInicio}${hora}.`,
        'Entendido',
        { duration: 7000 },
      );
      return;
    }

    const clienteNombre = `${alquiler.cliente?.nombres ?? ''} ${alquiler.cliente?.apellidos ?? ''}`.trim() || 'el cliente';
    const vehiculoNombre = this.nombreVehiculo(alquiler);
    const placa = alquiler.placa || alquiler.vehiculoUnidad?.placa || (alquiler as any).vehiculo?.placa;
    const placaTexto = placa ? ` (Placa: ${placa})` : '';

    const data: ConfirmDialogData = {
      titulo: 'Entregar Llaves y Activar Contrato',
      subtitulo: 'Entrega de vehículo e inicio de ruta',
      mensaje: `¿Deseas confirmar la entrega de llaves e inicio de ruta?

• Cliente: ${clienteNombre}
• Vehículo: ${vehiculoNombre}${placaTexto}
• Garantía: Depósito retenido en POS

El vehículo pasará inmediatamente al estado En ruta.`,
      textoConfirmar: 'Sí, Entregar Llaves y Activar',
      textoCancelar: 'Cancelar',
      tipo: 'finalizar',
    };

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '500px',
    });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.alquilerService.entregarLlaves(alquiler.idAlquiler!).subscribe({
        next: () => this.alquilerService.cargar(),
        error: (err) => this.mostrarError(err, 'entregar las llaves'),
      });
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

