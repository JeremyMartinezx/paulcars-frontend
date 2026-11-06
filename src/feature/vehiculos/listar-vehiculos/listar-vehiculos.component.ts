import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Vehiculo } from '../../../core/models/vehiculo.model';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { VehiculoFormDialogComponent } from '../vehiculo-form-dialog/vehiculo-form-dialog.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { AuthService } from '../../../core/service/auth.service';

import { GestionarUnidadesDialogComponent } from '../gestionar-unidades-dialog/gestionar-unidades-dialog.component';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';

type FiltroEstado = 'TODOS' | 'CON_STOCK' | 'SIN_STOCK' | 'NO_DISPONIBLE' | string;

@Component({
  selector: 'app-listar-vehiculos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    BackButtonComponent,


  ],
  templateUrl: './listar-vehiculos.component.html',
  styleUrl: './listar-vehiculos.component.css' 
})
export class ListarVehiculosComponent implements OnInit {
  private readonly vehiculoService = inject(VehiculoService);
  private readonly dialog = inject(MatDialog);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');
  readonly esStaff = computed(() => {
    const r = this.authService.rolActual();
    return r === 'ADMIN' || r === 'EMPLEADO';
  });
  readonly imagenVehiculo = obtenerImagenVehiculo;

  readonly columnas = ['vehiculo', 'tipo', 'anio', 'precio', 'unidadesTotales', 'unidadesDisponibles', 'acciones'];

  readonly busqueda = signal('');
  readonly filtroTipo = signal<string>('TODOS');
  readonly filtroEstado = signal<FiltroEstado>('TODOS');

  readonly vehiculos = this.vehiculoService.vehiculos;

  readonly tipos = computed(() => {
    const presentes = new Set(
      this.vehiculos().map((v) => (v.tipo?.nombreTipo || v.tipo || '')?.toUpperCase()).filter((t): t is string => !!t)
    );
    const orden = ['SEDAN', 'SUV', 'PICKUP', 'HATCHBACK'];
    const categorias: string[] = ['TODOS'];
    for (const cat of orden) {
      if (presentes.has(cat)) categorias.push(cat);
    }
    for (const cat of presentes) {
      if (!categorias.includes(cat)) categorias.push(cat);
    }
    return categorias;
  });

  formatearTipo(tipo: string): string {
    switch (tipo?.toUpperCase()) {
      case 'TODOS': return 'Todas';
      case 'SEDAN': return 'Sedán';
      case 'SUV': return 'SUV';
      case 'PICKUP': return 'Pickup';
      case 'HATCHBACK': return 'Hatchback';
      default: return tipo;
    }
  }

  readonly vehiculosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();
    const tipo = this.filtroTipo();

    return this.vehiculos().filter((v) => {
      const marca = v.modelo?.marca?.nombreMarca || (v as any).marca?.nombreMarca || (v as any).marca || '';
      const mod = v.modelo?.modelo || (v as any).nombreModelo || '';
      const marcaModelo = `${marca} ${mod}`.toLowerCase();
      const coincideTexto = !texto || marcaModelo.includes(texto);

      let coincideEstado = true;
      const esInactivo = v.activo === false || (v.estado?.nombreEstado || '').toUpperCase() === 'NO DISPONIBLE';
      const disp = v.unidadesDisponibles ?? 0;

      if (estado === 'CON_STOCK' || estado === 'DISPONIBLE') {
        coincideEstado = !esInactivo && disp > 0;
      } else if (estado === 'SIN_STOCK') {
        coincideEstado = !esInactivo && disp === 0;
      } else if (estado === 'NO_DISPONIBLE' || estado === 'NO DISPONIBLE') {
        coincideEstado = esInactivo;
      } else {
        coincideEstado = true;
      }

      const tipoNom = (v.tipo?.nombreTipo || v.tipo || '').toString().toUpperCase();
      const coincideTipo = tipo === 'TODOS' || tipoNom === tipo.toUpperCase();

      return coincideTexto && coincideEstado && coincideTipo;
    });
  });

  readonly paginaActual = signal(1);
  readonly tamanoPagina = signal(6);

  readonly totalPaginas = computed(() => {
    const total = this.vehiculosFiltrados().length;
    return Math.max(1, Math.ceil(total / this.tamanoPagina()));
  });

  readonly vehiculosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.vehiculosFiltrados().slice(inicio, inicio + this.tamanoPagina());
  });

  readonly rangoInicio = computed(() => {
    if (this.vehiculosFiltrados().length === 0) return 0;
    return (this.paginaActual() - 1) * this.tamanoPagina() + 1;
  });

  readonly rangoFin = computed(() => {
    return Math.min(this.paginaActual() * this.tamanoPagina(), this.vehiculosFiltrados().length);
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
    this.vehiculoService.cargar();
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  filtrarPorTipo(tipo: string): void {
    this.filtroTipo.set(tipo || 'TODOS');
    this.paginaActual.set(1);
  }

  filtrarPorEstado(estado: FiltroEstado): void {
    this.filtroEstado.set(estado);
    this.paginaActual.set(1);
  }

  abrirNuevo(): void {
    const ref = this.dialog.open(VehiculoFormDialogComponent, {
      data: {},
      width: '680px'
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      this.vehiculoService.agregar(resultado).subscribe({
        next: () => {
          
          this.paginaActual.set(1);
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Error al registrar el modelo', 'Cerrar', { duration: 5000 });
        }
      });
    });
  }

  editar(vehiculo: Vehiculo): void {
    const ref = this.dialog.open(VehiculoFormDialogComponent, {
      data: { vehiculo },
      width: '680px'
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      this.vehiculoService.actualizar(vehiculo.idVehiculo!, resultado).subscribe({
        next: () => this.vehiculoService.cargar(),
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Error al actualizar el vehículo', 'Cerrar', { duration: 5000 });
        }
      });
    });
  }

  eliminar(vehiculo: Vehiculo): void {
    const nombre = `${vehiculo.modelo?.marca?.nombreMarca || (vehiculo as any).marca || ''} ${vehiculo.modelo?.modelo || (vehiculo as any).nombreModelo || ''}`;
    const data: ConfirmDialogData = {
      titulo: 'Eliminar modelo de vehículo',
      mensaje: `¿Seguro que deseas eliminar el catálogo de ${nombre}? Esta acción no se puede deshacer.`,
      textoCancelar: 'Cancelar',
      textoConfirmar: 'Confirmar',
      tipo: 'eliminar'
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { data, width: '420px', autoFocus: false });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.vehiculoService.eliminar(vehiculo.idVehiculo!).subscribe({
        next: () => this.vehiculoService.cargar(),
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Error al eliminar el modelo', 'Cerrar', { duration: 5000 });
        }
      });
    });
  }

  gestionarUnidades(vehiculo: Vehiculo): void {
    const ref = this.dialog.open(GestionarUnidadesDialogComponent, {
      data: { vehiculo },
      width: '840px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false
    });

    ref.afterClosed().subscribe(() => {
      this.vehiculoService.cargar();
    });
  }

  esDisponible(v: Vehiculo): boolean {
    return v.activo !== false && (v.estado?.nombreEstado || '').toUpperCase() !== 'NO DISPONIBLE';
  }

  toggleDisponibilidad(vehiculo: Vehiculo): void {
    const actualmenteDisponible = this.esDisponible(vehiculo);
    const nuevoEstado = actualmenteDisponible ? 'NO DISPONIBLE' : 'DISPONIBLE';
    const nuevoIdEstado = actualmenteDisponible ? 8 : 6;
    const nombreModelo = `${vehiculo.modelo?.marca?.nombreMarca || (vehiculo as any).marca || ''} ${vehiculo.modelo?.modelo || (vehiculo as any).nombreModelo || ''}`.trim();

    const data: ConfirmDialogData = {
      titulo: actualmenteDisponible ? 'Desactivar vehículo' : 'Activar vehículo',
      subtitulo: 'Disponibilidad de flota',
      icono: actualmenteDisponible ? 'car_off' : 'car_on',
      mensaje: actualmenteDisponible
        ? `¿Seguro que deseas cambiar el estado de ${nombreModelo} a NO DISPONIBLE? Las unidades no estarán disponibles para nuevas reservas.`
        : `¿Deseas activar el vehículo ${nombreModelo} y cambiar su estado a DISPONIBLE?`,
      textoConfirmar: actualmenteDisponible ? 'Desactivar' : 'Activar',
      textoCancelar: 'Cancelar',
      tipo: actualmenteDisponible ? 'advertencia' : 'finalizar'
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { data, width: '430px', autoFocus: false });
    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.vehiculoService.actualizar(vehiculo.idVehiculo!, {
        ...vehiculo,
        activo: !actualmenteDisponible,
        estado: { idEstado: nuevoIdEstado, nombreEstado: nuevoEstado } as any
      }).subscribe({
        next: () => {
          this.snackBar.open(`Modelo ${nombreModelo}: marcado como ${nuevoEstado}`, 'OK', { duration: 3000 });
          this.vehiculoService.cargar();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || 'Error al cambiar el estado del modelo', 'Cerrar', { duration: 4000 });
        }
      });
    });
  }

  // Asesor: inspección operativa
  cambiarEstadoOperativo(vehiculo: Vehiculo): void {
    this.gestionarUnidades(vehiculo);
  }

  claseEstado(estado?: string): string {
    switch (estado) {
      case 'DISPONIBLE':
        return 'estado-disponible';
      case 'MANTENIMIENTO':
      case 'NO DISPONIBLE':
        return 'estado-mantenimiento';
      case 'LIMPIEZA':
        return 'estado-limpieza';
      default:
        return 'estado-alquilado';
    }
  }

  iconoPorTipo(nombreTipo?: string): string {
    return 'directions_car';
  }

  colorFondo(color?: string): string {
    return '#f1f5f9';
  }
}
