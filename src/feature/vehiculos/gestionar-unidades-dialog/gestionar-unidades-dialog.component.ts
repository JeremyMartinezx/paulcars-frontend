import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { Vehiculo, VehiculoUnidad } from '../../../core/models/vehiculo.model';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { AuthService } from '../../../core/service/auth.service';

export interface GestionarUnidadesData {
  vehiculo: Vehiculo;
}

@Component({
  selector: 'app-gestionar-unidades-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './gestionar-unidades-dialog.component.html',
  styleUrl: './gestionar-unidades-dialog.component.css'
})
export class GestionarUnidadesDialogComponent implements OnInit {
  readonly data: GestionarUnidadesData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<GestionarUnidadesDialogComponent>);
  private readonly vehiculoService = inject(VehiculoService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');

  readonly unidades = signal<VehiculoUnidad[]>([]);
  readonly unidadesDisponibles = computed(() =>
    this.unidades().filter(u => u.estado?.nombreEstado === 'DISPONIBLE').length
  );
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly mostrarFormulario = signal(false);

  // Formulario de nueva placa (solo placa y sede)
  nuevaPlaca = '';
  nuevaSede = 'MIRAFLORES';

  // Filtro único por estado operativo: TODOS | DISPONIBLE | MANTENIMIENTO | LIMPIEZA | ALQUILADO
  readonly filtroEstado = signal<'TODOS' | 'DISPONIBLE' | 'MANTENIMIENTO' | 'LIMPIEZA' | 'ALQUILADO'>('TODOS');

  private getEstadoPrioridad(estadoNombre?: string): number {
    const e = (estadoNombre || '').toUpperCase();
    if (e === 'DISPONIBLE') return 1;
    if (e === 'LIMPIEZA') return 2;
    if (e === 'MANTENIMIENTO') return 3;
    if (e === 'ALQUILADO' || e === 'EN_RUTA') return 4;
    return 5;
  }

  readonly unidadesFiltradas = computed(() => {
    const f = this.filtroEstado();
    const list = this.unidades();
    const filtradas = f === 'TODOS'
      ? [...list]
      : list.filter(u => {
          const e = (u.estado?.nombreEstado || '').toUpperCase();
          if (f === 'ALQUILADO') return e === 'ALQUILADO' || e === 'EN_RUTA';
          return e === f;
        });

    // Ordenamiento prioritario solicitado:
    // 1° DISPONIBLE, 2° LIMPIEZA, 3° MANTENIMIENTO, luego ALQUILADO
    return filtradas.sort((a, b) => {
      const prioA = this.getEstadoPrioridad(a.estado?.nombreEstado);
      const prioB = this.getEstadoPrioridad(b.estado?.nombreEstado);
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      return (a.placa || '').localeCompare(b.placa || '');
    });
  });

  readonly estadosPosibles = [
    { valor: 'DISPONIBLE', label: 'Disponible', color: 'disp' },
    { valor: 'MANTENIMIENTO', label: 'Mantenimiento', color: 'mant' },
    { valor: 'LIMPIEZA', label: 'Limpieza', color: 'limp' },
    { valor: 'ALQUILADO', label: 'Alquilado', color: 'alq' }
  ];

  obtenerEstadoValor(u: VehiculoUnidad): string {
    const nom = (u.estado?.nombreEstado || '').toUpperCase();
    if (nom === 'EN_RUTA' || nom === 'ALQUILADO') {
      return 'ALQUILADO';
    }
    return nom || 'DISPONIBLE';
  }

  obtenerEstadoLabel(valor: string): string {
    switch (valor) {
      case 'DISPONIBLE': return 'Disponible';
      case 'MANTENIMIENTO': return 'Mantenimiento';
      case 'LIMPIEZA': return 'Limpieza';
      case 'ALQUILADO': return 'Alquilado';
      default: return valor;
    }
  }

  obtenerColorDot(valor: string): string {
    switch (valor) {
      case 'DISPONIBLE': return 'disp';
      case 'MANTENIMIENTO': return 'mant';
      case 'LIMPIEZA': return 'limp';
      case 'ALQUILADO': return 'alq';
      default: return 'disp';
    }
  }

  // Paginación: exactamente 3 unidades por página
  readonly paginaActual = signal(1);
  readonly itemsPorPagina = 3;

  readonly totalPaginas = computed(() =>
    Math.ceil(this.unidadesFiltradas().length / this.itemsPorPagina) || 1
  );

  readonly unidadesPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.itemsPorPagina;
    return this.unidadesFiltradas().slice(inicio, inicio + this.itemsPorPagina);
  });

  readonly paginasArray = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1)
  );

  readonly rangoInicio = computed(() =>
    this.unidadesFiltradas().length === 0 ? 0 : (this.paginaActual() - 1) * this.itemsPorPagina + 1
  );

  readonly rangoFin = computed(() =>
    Math.min(this.paginaActual() * this.itemsPorPagina, this.unidadesFiltradas().length)
  );

  readonly etiquetaFiltro = computed(() => {
    switch (this.filtroEstado()) {
      case 'DISPONIBLE':
        return `Disponible (${this.conteoPorEstado('DISPONIBLE')})`;
      case 'MANTENIMIENTO':
        return `Mantenimiento (${this.conteoPorEstado('MANTENIMIENTO')})`;
      case 'LIMPIEZA':
        return `Limpieza (${this.conteoPorEstado('LIMPIEZA')})`;
      case 'ALQUILADO':
        return `Alquilado (${this.conteoPorEstado('ALQUILADO')})`;
      default:
        return 'Filtrar por Estado';
    }
  });

  conteoPorEstado(estado: string): number {
    return this.unidades().filter(u => {
      const e = (u.estado?.nombreEstado || '').toUpperCase();
      if (estado === 'ALQUILADO') return e === 'ALQUILADO' || e === 'EN_RUTA';
      return e === estado;
    }).length;
  }

  setFiltroEstado(nuevo: 'TODOS' | 'DISPONIBLE' | 'MANTENIMIENTO' | 'LIMPIEZA' | 'ALQUILADO'): void {
    this.filtroEstado.set(nuevo);
    this.paginaActual.set(1);
  }

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) {
      this.paginaActual.set(p);
    }
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) {
      this.paginaActual.update(p => p - 1);
    } else {
      this.paginaActual.set(this.totalPaginas());
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.update(p => p + 1);
    } else {
      this.paginaActual.set(1);
    }
  }

  ngOnInit(): void {
    this.cargarUnidades();
  }

  get idModelo(): number {
    return this.data.vehiculo.idModelo ?? this.data.vehiculo.idVehiculo ?? 0;
  }

  get nombreVehiculo(): string {
    const v = this.data.vehiculo;
    const marca = v.modelo?.marca?.nombreMarca || (v as any).marca?.nombreMarca || (v as any).marca || '';
    const modelo = v.modelo?.modelo || (v as any).nombreModelo || '';
    return `${marca} ${modelo} (${v.anio})`;
  }

  get colorVehiculo(): string {
    const v = this.data.vehiculo;
    const mod = (v.modelo?.modelo || (v as any).nombreModelo || '').toLowerCase();
    if (mod.includes('swift')) return 'Amarillo Deportivo';
    if (mod.includes('mazda 3') || mod === '3') return 'Gris Polymetal';
    if (mod.includes('kicks')) return 'Azul Eléctrico';
    if (mod.includes('asx')) return 'Gris Titanio';
    if (mod.includes('ranger')) return 'Azul Relámpago';
    if (mod.includes('corolla')) return 'Blanco Glaciar';
    if (mod.includes('versa')) return 'Blanco Polar';
    if (mod.includes('tucson')) return 'Negro Fantasma';
    if (mod.includes('hilux')) return 'Plata';
    if (mod.includes('l200')) return 'Blanco Polar';
    if (mod.includes('rio')) return 'Rojo Fuego';
    return v.color || 'Gris Plata';
  }

  cargarUnidades(): void {
    this.cargando.set(true);
    this.vehiculoService.obtenerUnidades(this.idModelo).subscribe({
      next: (lista) => {
        const col = this.colorVehiculo;
        const ajustadas = lista.map(u => ({
          ...u,
          color: col
        }));
        this.unidades.set(ajustadas);
        this.cargando.set(false);
        if (this.paginaActual() > this.totalPaginas()) {
          this.paginaActual.set(Math.max(1, this.totalPaginas()));
        }
      },
      error: () => {
        this.cargando.set(false);
        this.snackBar.open('Error al cargar la flota de unidades', 'Cerrar', { duration: 3000 });
      }
    });
  }

  cambiarEstado(u: VehiculoUnidad, nuevoEstado: string): void {
    if (!u.idUnidad) return;
    this.vehiculoService.cambiarEstadoUnidad(u.idUnidad, nuevoEstado).subscribe({
      next: () => {
        this.snackBar.open(`Placa ${u.placa}: Estado actualizado a ${nuevoEstado}`, 'OK', { duration: 2500 });
        this.cargarUnidades();
      },
      error: (err) => {
        const msg = err.error?.message || 'No se pudo cambiar el estado de la unidad';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      }
    });
  }

  agregarNuevaUnidad(): void {
    const placaLimpiada = this.nuevaPlaca.trim().toUpperCase();
    if (!placaLimpiada) {
      this.snackBar.open('Ingresa una placa válida', 'Cerrar', { duration: 2500 });
      return;
    }

    this.guardando.set(true);
    const nueva: Partial<VehiculoUnidad> = {
      placa: placaLimpiada,
      color: this.colorVehiculo,
      sede: this.nuevaSede,
      kilometraje: 0,
      estado: { idEstado: 6, nombreEstado: 'DISPONIBLE' }
    };

    this.vehiculoService.agregarUnidad(this.idModelo, nueva).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.open(`¡Unidad con placa ${placaLimpiada} agregada a la flota!`, 'OK', { duration: 3000 });
        this.nuevaPlaca = '';
        this.mostrarFormulario.set(false);
        this.cargarUnidades();
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err.error?.message || 'Error al agregar la unidad (verifica que la placa no esté duplicada)';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
      }
    });
  }

  eliminarUnidad(u: VehiculoUnidad): void {
    if (!u.idUnidad) return;

    this.vehiculoService.eliminarUnidad(u.idUnidad).subscribe({
      next: () => {
        this.snackBar.open(`Placa ${u.placa} eliminada del inventario`, 'OK', { duration: 2500 });
        this.cargarUnidades();
      },
      error: (err) => {
        const msg = err.error?.message || 'No se pudo eliminar la unidad física';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
      }
    });
  }

  cerrar(): void {
    this.dialogRef.close(true);
  }
}
