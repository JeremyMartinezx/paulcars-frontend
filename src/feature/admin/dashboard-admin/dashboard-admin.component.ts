import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { AlquilerService } from '../../../core/service/alquiler.service';
import { ClienteService } from '../../../core/service/cliente.service';
import { VehiculoService } from '../../../core/service/vehiculo.service';

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './dashboard-admin.component.html',
  styleUrl: './dashboard-admin.component.css'
})
export class DashboardAdminComponent implements OnInit {
  private readonly vehiculoService = inject(VehiculoService);
  private readonly clienteService = inject(ClienteService);
  private readonly alquilerService = inject(AlquilerService);

  readonly vehiculos = computed(() => this.vehiculoService.vehiculos().length);
  readonly clientes = computed(() => this.clienteService.clientes().length);
  readonly alquileresActivos = computed(
    () => this.alquilerService.alquileres().filter((alquiler) => alquiler.estado?.nombreEstado === 'ACTIVO').length
  );

  ngOnInit(): void {
    this.vehiculoService.cargar();
    this.clienteService.cargar();
    this.alquilerService.cargar();
  }
}