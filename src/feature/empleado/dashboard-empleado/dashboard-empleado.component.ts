import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { AlquilerService } from '../../../core/service/alquiler.service';
import { ClienteService } from '../../../core/service/cliente.service';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { ReporteService } from '../../../core/service/reporte.service';
import { ReporteOperativo } from '../../../core/models/reporte.model';

@Component({
  selector: 'app-dashboard-empleado',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './dashboard-empleado.component.html',
  styleUrl: './dashboard-empleado.component.css'
})
export class DashboardEmpleadoComponent implements OnInit {
  private readonly vehiculoService = inject(VehiculoService);
  private readonly clienteService = inject(ClienteService);
  private readonly alquilerService = inject(AlquilerService);
  private readonly reporteService = inject(ReporteService);

  // Métricas operativas del día (GET /api/reportes/operativo)
  readonly operativo = signal<ReporteOperativo | null>(null);

  readonly vehiculosDisponibles = computed(
    () => this.vehiculoService.vehiculos().filter((v) => v.estado?.nombreEstado === 'DISPONIBLE').length
  );
  readonly clientesRegistrados = computed(() => this.clienteService.clientes().length);
  readonly alquileresActivos = computed(
    () => this.alquilerService.alquileres().filter((a) => a.estado?.nombreEstado === 'ACTIVO').length
  );

  ngOnInit(): void {
    this.vehiculoService.cargar();
    this.clienteService.cargar();
    this.alquilerService.cargar();
    this.cargarMetricasOperativas();
  }

  private cargarMetricasOperativas(): void {
    this.reporteService.operativo().subscribe({
      next: (data: ReporteOperativo) => this.operativo.set(data),
      error: () => this.operativo.set(null)
    });
  }
}
