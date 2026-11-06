import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FilaMonto, ReporteEjecutivo } from '../../../core/models/reporte.model';
import { ReporteService } from '../../../core/service/reporte.service';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';

// Dashboard de Business Intelligence automotriz (exclusivo admin)
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    BackButtonComponent
  ],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  private readonly reporteService = inject(ReporteService);

  // Filtros (por defecto: mes en curso con fecha local)
  desde = this.primerDiaDelMes();
  hasta = this.hoyLocal();
  sede = 'TODAS';
  categoria = 'TODAS';

  readonly sedes = [
    { valor: 'TODAS', titulo: 'Todas las sedes' },
    { valor: 'MIRAFLORES', titulo: 'Miraflores' },
    { valor: 'AEROPUERTO', titulo: 'Aeropuerto' }
  ];
  readonly categorias = ['TODAS', 'HATCHBACK', 'SEDAN', 'SUV', 'PICKUP'];

  readonly reporte = signal<ReporteEjecutivo | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.consultar();
  }

  consultar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.reporteService
      .ejecutivo({ desde: this.desde, hasta: this.hasta, sede: this.sede, categoria: this.categoria })
      .subscribe({
        next: (r) => {
          this.reporte.set(r);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(err?.error?.message || 'No se pudo cargar el reporte.');
        }
      });
  }

  limpiar(): void {
    this.desde = this.primerDiaDelMes();
    this.hasta = this.hoyLocal();
    this.sede = 'TODAS';
    this.categoria = 'TODAS';
    this.consultar();
  }

  // Los tres gráficos de barras del dashboard
  graficos(r: ReporteEjecutivo): { titulo: string; filas: FilaMonto[] }[] {
    return [
      { titulo: 'Ingresos por sede', filas: r.ingresosPorSede },
      { titulo: 'Ingresos por categoría', filas: r.ingresosPorCategoria },
      { titulo: 'Arqueo de caja por método de pago', filas: r.ingresosPorMetodo }
    ];
  }

  // Ancho de cada barra del gráfico respecto a la barra más grande
  anchoBarra(fila: FilaMonto, filas: FilaMonto[]): number {
    const max = Math.max(...filas.map((f) => Number(f.total)), 0);
    return max > 0 ? Math.max(4, (Number(fila.total) / max) * 100) : 0;
  }

  // Exporta KPIs y el top de vehículos a un CSV que abre Excel
  exportarCsv(): void {
    const r = this.reporte();
    if (!r) return;
    const filas: (string | number)[][] = [
      ['Reporte ejecutivo Paul Cars'],
      ['Periodo', `${r.desde} a ${r.hasta}`],
      ['Sede', r.sede],
      ['Categoría', r.categoria],
      [],
      ['KPI', 'Valor'],
      ['Ingresos totales (S/)', r.ingresosTotales],
      ['Ocupación de flota (%)', r.ocupacionFlota],
      ['Ticket promedio (S/)', r.ticketPromedio],
      ['Contratos iniciados', r.alquileresEnPeriodo],
      ['Contratos finalizados', r.alquileresFinalizados],
      ['Total días alquilados', r.diasTotalesAlquilados],
      [],
      ['Vehículo', 'Placa', 'Categoría', 'Alquileres', 'Días alquilados', 'Ingresos (S/)', 'Utilización (%)'],
      ...r.topVehiculos.map((v) => [v.vehiculo, v.placa, v.categoria, v.alquileres, v.diasAlquilados, v.ingresos, v.utilizacion]),
      [],
      ['Arqueo por método de pago', 'Operaciones', 'Total (S/)'],
      ...r.ingresosPorMetodo.map((m) => [m.etiqueta, m.cantidad, m.total])
    ];
    // Punto y coma: Excel en español lo separa en columnas sin configurar nada
    const csv = filas
      .map((fila) => fila.map((celda) => `"${String(celda ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-paulcars-${r.desde}-a-${r.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private hoyLocal(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private primerDiaDelMes(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }
}
