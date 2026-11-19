import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { FilaMonto, ReporteEjecutivo, UnidadOpcion } from '../../../core/models/reporte.model';
import { ReporteService } from '../../../core/service/reporte.service';
import { descargarBlob } from '../../../core/utils/descarga.util';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { VisorPdfDialogComponent } from '../../../shared/components/visor-pdf-dialog/visor-pdf-dialog.component';

type Vista = 'RESUMEN' | 'GENERAR';
type Rango = 'HOY' | 'AYER' | 'SEMANA' | 'MES' | 'MES_ANTERIOR' | 'PERSONALIZADO';

// Reportes en dos pestañas: un resumen con los indicadores y un formulario simple para generar el reporte
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatIconModule, BackButtonComponent],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  private readonly reporteService = inject(ReporteService);
  private readonly dialog = inject(MatDialog);

  readonly vista = signal<Vista>('RESUMEN');

  // ───────── Periodo (compartido por las dos pestañas) ─────────
  readonly rangos: { valor: Rango; titulo: string }[] = [
    { valor: 'HOY', titulo: 'Hoy' },
    { valor: 'AYER', titulo: 'Ayer' },
    { valor: 'SEMANA', titulo: 'Últimos 7 días' },
    { valor: 'MES', titulo: 'Este mes' },
    { valor: 'MES_ANTERIOR', titulo: 'Mes anterior' }
  ];
  readonly rango = signal<Rango>('HOY');
  readonly desde = signal(this.formato(new Date()));
  readonly hasta = signal(this.formato(new Date()));

  // ───────── Pestaña Resumen ─────────
  readonly resumen = signal<ReporteEjecutivo | null>(null);
  readonly cargando = signal(false);
  // Flota más alquilada: solo unidades con placa, ordenadas por número de alquileres y luego por ingreso
  readonly topVehiculos = computed(() =>
    (this.resumen()?.topVehiculos ?? [])
      .filter((v) => Number(v.alquileres) > 0 && !(v.placa ?? '').startsWith('Sin placa'))
      .sort((a, b) => Number(b.alquileres) - Number(a.alquileres) || Number(b.ingresos) - Number(a.ingresos))
      .slice(0, 6)
  );

  // ───────── Pestaña Generar reporte ─────────
  readonly unidades = signal<UnidadOpcion[]>([]);
  readonly modelo = signal('TODOS');
  readonly placa = signal('TODAS');
  readonly placaAbierta = signal(false);

  elegirPlaca(p: string): void {
    this.placa.set(p);
    this.placaAbierta.set(false);
  }
  readonly modelos = computed(() => [...new Set(this.unidades().map((u) => u.nombre))].sort());
  readonly placas = computed(() =>
    this.unidades()
      .filter((u) => this.modelo() === 'TODOS' || u.nombre === this.modelo())
      .map((u) => u.placa)
      .sort()
  );
  readonly cliente = signal('');
  readonly estado = signal('CON_PAGO');
  readonly sede = signal('TODAS');
  readonly metodo = signal('TODOS');
  readonly generando = signal(false);
  readonly error = signal<string | null>(null);

  readonly sedes = [
    { valor: 'TODAS', titulo: 'Todas' },
    { valor: 'MIRAFLORES', titulo: 'Miraflores' },
    { valor: 'AEROPUERTO', titulo: 'Aeropuerto' }
  ];
  readonly metodos = ['TODOS', 'Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia'];

  readonly estados = [
    { valor: 'CON_PAGO', titulo: 'Con pago (pagados, en ruta y finalizados)' },
    { valor: 'TODOS', titulo: 'Todos (incluye pendientes y anulados)' },
    { valor: 'PENDIENTE', titulo: 'Solicitudes pendientes' },
    { valor: 'POR_PAGAR', titulo: 'Reservados por pagar' },
    { valor: 'PAGADO', titulo: 'Reservados y pagados' },
    { valor: 'EN_RUTA', titulo: 'En ruta' },
    { valor: 'FINALIZADO', titulo: 'Finalizados' },
    { valor: 'ANULADO', titulo: 'Anulados' }
  ];

  ngOnInit(): void {
    this.reporteService.unidades().subscribe({ next: (u) => this.unidades.set(u), error: () => this.unidades.set([]) });
    this.cargarResumen();
  }

  elegirRango(r: Rango): void {
    this.rango.set(r);
    const hoy = new Date();
    if (r === 'HOY') this.fijar(hoy, hoy);
    else if (r === 'AYER') {
      const a = new Date(hoy);
      a.setDate(hoy.getDate() - 1);
      this.fijar(a, a);
    } else if (r === 'SEMANA') {
      const a = new Date(hoy);
      a.setDate(hoy.getDate() - 6);
      this.fijar(a, hoy);
    } else if (r === 'MES') this.fijar(new Date(hoy.getFullYear(), hoy.getMonth(), 1), hoy);
    else if (r === 'MES_ANTERIOR') this.fijar(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), new Date(hoy.getFullYear(), hoy.getMonth(), 0));
    this.cargarResumen();
  }

  cambiarFecha(campo: 'desde' | 'hasta', valor: string): void {
    if (!valor) return;
    (campo === 'desde' ? this.desde : this.hasta).set(valor);
    this.rango.set('PERSONALIZADO');
    if (this.desde() <= this.hasta()) this.cargarResumen();
  }

  cambiarModelo(valor: string): void {
    this.modelo.set(valor);
    this.placa.set('TODAS');
  }

  private fijar(a: Date, b: Date): void {
    this.desde.set(this.formato(a));
    this.hasta.set(this.formato(b));
  }

  cargarResumen(): void {
    this.cargando.set(true);
    this.reporteService.ejecutivo({ desde: this.desde(), hasta: this.hasta() }).subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.cargando.set(false);
      },
      error: () => {
        this.resumen.set(null);
        this.cargando.set(false);
      }
    });
  }

  anchoBarra(f: FilaMonto, filas: FilaMonto[]): number {
    const max = Math.max(...filas.map((x) => Number(x.total)), 0);
    return max > 0 ? Math.max(4, (Number(f.total) / max) * 100) : 0;
  }

  periodoTexto(): string {
    const f = (iso: string) => iso.split('-').reverse().join('/');
    return this.desde() === this.hasta() ? f(this.desde()) : `${f(this.desde())} al ${f(this.hasta())}`;
  }

  // ───────── Generar ─────────
  generar(formato: 'pdf' | 'excel'): void {
    this.error.set(null);
    if (this.desde() > this.hasta()) {
      this.error.set('La fecha «Desde» no puede ser posterior a «Hasta».');
      return;
    }
    const filtro = {
      desde: this.desde(),
      hasta: this.hasta(),
      modelo: this.modelo(),
      placa: this.placa(),
      q: this.cliente(),
      estado: this.estado(),
      sede: this.sede(),
      metodo: this.metodo()
    };
    const rango = this.desde() === this.hasta() ? this.desde() : `${this.desde()}_a_${this.hasta()}`;

    this.generando.set(true);
    this.reporteService.resumen(formato, filtro).subscribe({
      next: (blob) => {
        this.generando.set(false);
        if (!blob || blob.size === 0) {
          this.error.set('No hay contratos registrados en ese periodo con los filtros elegidos.');
          return;
        }
        if (formato === 'excel') {
          descargarBlob(blob, `Reporte-PaulCars_${rango}.xlsx`);
          return;
        }
        this.dialog.open(VisorPdfDialogComponent, {
          width: '900px',
          maxWidth: '96vw',
          data: {
            titulo: 'Reporte de contratos',
            subtitulo: this.periodoTexto(),
            pdf$: of(blob),
            nombreArchivo: `Reporte-PaulCars_${rango}.pdf`
          }
        });
      },
      error: () => {
        this.generando.set(false);
        this.error.set('No se pudo generar el reporte. Inténtelo nuevamente.');
      }
    });
  }

  private formato(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
