import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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
  private readonly dialog = inject(MatDialog);
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
  nuevoKm: number | null = 0;
  nuevaSede = 'MIRAFLORES';

  // Filtro único por estado operativo: TODOS | DISPONIBLE | MANTENIMIENTO | LIMPIEZA | ALQUILADO | NO DISPONIBLE
  readonly filtroEstado = signal<'TODOS' | 'DISPONIBLE' | 'MANTENIMIENTO' | 'LIMPIEZA' | 'ALQUILADO' | 'NO DISPONIBLE'>('TODOS');

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

  // Flujo permitido (el mismo que valida el servidor). «Alquilado» lo pone y lo quita el sistema, no se elige.
  private readonly TRANSICIONES: Record<string, string[]> = {
    DISPONIBLE: ['LIMPIEZA', 'MANTENIMIENTO', 'NO DISPONIBLE'],
    LIMPIEZA: ['DISPONIBLE', 'MANTENIMIENTO', 'NO DISPONIBLE'],
    MANTENIMIENTO: ['LIMPIEZA', 'NO DISPONIBLE'],
    'NO DISPONIBLE': ['LIMPIEZA', 'MANTENIMIENTO']
  };

  // Una unidad alquilada con un cliente no se puede mover: se libera sola al recibir el vehículo
  estaAlquilada(u: VehiculoUnidad): boolean {
    return this.obtenerEstadoValor(u) === 'ALQUILADO' || !!u.idAlquilerActual;
  }

  // Opciones que se ofrecen para una placa: su estado actual y solo los pasos que el flujo permite
  opcionesEstado(u: VehiculoUnidad): { valor: string; label: string; color: string }[] {
    const actual = this.obtenerEstadoValor(u);
    const meta = (valor: string, label?: string) => ({ valor, label: label ?? this.obtenerEstadoLabel(valor), color: this.obtenerColorDot(valor) });
    const lista = [meta(actual)];
    for (const destino of this.TRANSICIONES[actual] ?? []) {
      // Con una reserva próxima y sin otra placa libre para reemplazarla, la unidad está comprometida: no se ofrece limpieza
      if (destino === 'LIMPIEZA' && actual === 'DISPONIBLE' && u.reservaProximaBloquea && !u.reemplazoDisponible) continue;
      lista.push(actual === 'MANTENIMIENTO' && destino === 'LIMPIEZA'
        ? meta('LIMPIEZA', 'Mantenimiento terminado → Limpieza')
        : meta(destino));
    }
    return lista;
  }

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
      case 'NO DISPONIBLE': return 'No disponible';
      default: return valor;
    }
  }

  obtenerColorDot(valor: string): string {
    switch (valor) {
      case 'DISPONIBLE': return 'disp';
      case 'MANTENIMIENTO': return 'mant';
      case 'LIMPIEZA': return 'limp';
      case 'ALQUILADO': return 'alq';
      case 'NO DISPONIBLE': return 'nodisp';
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
      case 'NO DISPONIBLE':
        return `No disponible (${this.conteoPorEstado('NO DISPONIBLE')})`;
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

  setFiltroEstado(nuevo: 'TODOS' | 'DISPONIBLE' | 'MANTENIMIENTO' | 'LIMPIEZA' | 'ALQUILADO' | 'NO DISPONIBLE'): void {
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
    if (v.color) return v.color;
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
    const actual = this.obtenerEstadoValor(u);
    const km = (u.kilometraje ?? 0).toLocaleString('es-PE');
    let confirmacion: ConfirmDialogData | null = null;
    if (actual === 'MANTENIMIENTO' && nuevoEstado === 'LIMPIEZA') {
      // Terminar el mantenimiento es dar por hecho el servicio: el control de km vuelve a empezar
      const proximo = ((u.kilometraje ?? 0) + this.intervalo(u)).toLocaleString('es-PE');
      confirmacion = {
        titulo: 'Mantenimiento realizado',
        mensaje: `¿Confirma que la unidad ${u.placa} ya pasó por su mantenimiento? Pasará a Limpieza. El control volverá a empezar desde sus ${km} km: el próximo será a los ${proximo} km.`,
        textoConfirmar: 'Sí, mantenimiento realizado', textoCancelar: 'Cancelar', tipo: 'advertencia', icono: 'build'
      };
    } else if (nuevoEstado === 'LIMPIEZA') {
      const aviso = u.reservaProximaBloquea
        ? ' Su reserva próxima pasará automáticamente a otra placa libre del mismo modelo.'
        : '';
      confirmacion = {
        titulo: 'Enviar a limpieza',
        mensaje: `La unidad ${u.placa} pasará a Limpieza y no estará disponible para alquilar hasta que termine.${aviso} ¿Desea continuar?`,
        textoConfirmar: 'Sí, enviar a limpieza', textoCancelar: 'Cancelar', tipo: 'advertencia', icono: 'cleaning_services'
      };
    } else if (nuevoEstado === 'DISPONIBLE') {
      confirmacion = {
        titulo: 'Dejar disponible',
        mensaje: `¿Confirma que la unidad ${u.placa} está lista (limpia y revisada) y puede volver a alquilarse?`,
        textoConfirmar: 'Sí, dejar disponible', textoCancelar: 'Cancelar', tipo: 'advertencia', icono: 'check_circle'
      };
    } else if (nuevoEstado === 'MANTENIMIENTO') {
      confirmacion = {
        titulo: 'Enviar a mantenimiento',
        mensaje: `La unidad ${u.placa} saldrá de servicio y sus reservas aprobadas pasarán a otra unidad libre del mismo modelo. ¿Desea continuar?`,
        textoConfirmar: 'Sí, enviar a mantenimiento', textoCancelar: 'Cancelar', tipo: 'advertencia', icono: 'build'
      };
    } else if (nuevoEstado === 'NO DISPONIBLE') {
      confirmacion = {
        titulo: 'Marcar como no disponible',
        mensaje: `La unidad ${u.placa} saldrá de servicio y sus reservas aprobadas pasarán a otra unidad libre del mismo modelo. ¿Desea continuar?`,
        textoConfirmar: 'Sí, marcar no disponible', textoCancelar: 'Cancelar', tipo: 'advertencia', icono: 'block'
      };
    }
    if (confirmacion) {
      this.dialog.open(ConfirmDialogComponent, { width: '460px', maxWidth: '94vw', data: confirmacion })
        .afterClosed().subscribe((ok) => {
          if (ok) this.aplicarEstado(u, nuevoEstado);
          else this.cargarUnidades(); // devuelve el selector a su valor anterior
        });
      return;
    }
    this.aplicarEstado(u, nuevoEstado);
  }

  // Cada cuántos km la unidad necesita mantenimiento (lo define su modelo)
  private intervalo(u: VehiculoUnidad): number {
    return u.kmIntervaloMantenimiento || 10000;
  }

  private aplicarEstado(u: VehiculoUnidad, nuevoEstado: string): void {
    this.vehiculoService.cambiarEstadoUnidad(u.idUnidad!, nuevoEstado).subscribe({
      next: () => {
        // El filtro pasa al estado elegido y se muestra la página donde queda la placa, para ver el cambio de inmediato
        this.setFiltroEstado(nuevoEstado as 'DISPONIBLE' | 'MANTENIMIENTO' | 'LIMPIEZA' | 'NO DISPONIBLE');
        this.cargarUnidades();
      },
      error: (err) => {
        const msg = err.error?.message || 'No se pudo cambiar el estado de la unidad';
        this.snackBar.open(msg, 'Cerrar', { duration: 3500 });
        this.cargarUnidades(); // el selector vuelve al estado real de la placa
      }
    });
  }

  // Estado del mantenimiento de una placa según los km que le quedan
  estadoMantenimiento(u: VehiculoUnidad): { clase: string; texto: string } {
    // En mantenimiento: ya no importa cuánto faltaba; el administrador la habilita cuando el servicio termine
    if (this.obtenerEstadoValor(u) === 'MANTENIMIENTO') return { clase: 'mant-vencido', texto: 'En mantenimiento' };
    const restantes = u.kmRestantesMantenimiento;
    if (restantes === undefined || restantes === null) return { clase: 'mant-ok', texto: '—' };
    if (restantes <= 0) return { clase: 'mant-vencido', texto: 'Le toca mantenimiento' };
    if (restantes <= 1000) return { clase: 'mant-proximo', texto: `Faltan ${restantes.toLocaleString('es-PE')} km` };
    return { clase: 'mant-ok', texto: `Faltan ${restantes.toLocaleString('es-PE')} km` };
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
      kilometraje: this.nuevoKm ?? 0,
      sede: this.nuevaSede,
      estado: { idEstado: 6, nombreEstado: 'DISPONIBLE' }
    };

    this.vehiculoService.agregarUnidad(this.idModelo, nueva).subscribe({
      next: () => {
        this.guardando.set(false);
        this.snackBar.open('Unidad agregada correctamente.', 'OK', { duration: 3000 });
        this.nuevaPlaca = '';
        this.nuevoKm = 0;
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
        this.snackBar.open('Unidad eliminada correctamente.', 'OK', { duration: 2500 });
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
