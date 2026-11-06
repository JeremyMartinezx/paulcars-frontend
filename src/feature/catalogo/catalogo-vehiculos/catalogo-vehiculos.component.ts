import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Vehiculo } from '../../../core/models/vehiculo.model';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { AuthService } from '../../../core/service/auth.service';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import { SEDES_DISPONIBLES } from '../../../core/utils/tarifa-alquiler.util';

interface CatalogoFiltroState {
  filtroTipo: string;
  filtroEstado: string;
  paginaActual: number;
}

@Component({
  selector: 'app-catalogo-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatChipsModule, MatIconModule, MatTooltipModule],
  templateUrl: './catalogo-vehiculos.component.html',
  styleUrl: './catalogo-vehiculos.component.css'
})
export class CatalogoVehiculosComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vehiculoService = inject(VehiculoService);
  private readonly authService = inject(AuthService);
  readonly obtenerImagenVehiculo = obtenerImagenVehiculo;
  readonly sedesConfig = SEDES_DISPONIBLES;

  readonly esStaff = computed(() => {
    const r = this.authService.rolActual();
    return r === 'ADMIN' || r === 'EMPLEADO' || (r as string) === 'ASESOR';
  });

  private readonly estadoInicial = this.cargarEstado();
  readonly filtroTipo = signal(this.estadoInicial?.filtroTipo || 'TODOS');
  readonly filtroEstado = signal(this.estadoInicial?.filtroEstado || 'TODOS');
  readonly terminoBusqueda = signal<string>('');

  // Parámetros de búsqueda por sede y fechas
  readonly sedeFiltro = signal<string>('TODAS');
  readonly sedeDevolucionParam = signal<string>('');
  readonly fechaRecojoParam = signal<string>('');
  readonly horaRecojoParam = signal<string>('');
  readonly fechaDevolucionParam = signal<string>('');
  readonly horaDevolucionParam = signal<string>('');
  readonly diasCalculadosParam = signal<number>(0);

  readonly busquedaActiva = computed(() => {
    return this.sedeFiltro() !== 'TODAS' || !!this.fechaRecojoParam() || !!this.terminoBusqueda();
  });

  readonly tipos = computed(() => {
    const tipos = new Set(
      this.vehiculoService
        .vehiculos()
        .filter((v) => {
          const stock = v.unidadesDisponibles !== undefined
            ? v.unidadesDisponibles
            : (v.unidades ? v.unidades.filter((u) => (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE').length : 0);
          return v.activo !== false && stock > 0 && v.estado?.nombreEstado?.toUpperCase() === 'DISPONIBLE';
        })
        .map((v) => {
          const t = v.tipo?.nombreTipo || (typeof v.tipo === 'string' ? v.tipo : '') || v.tipoCarroceria || '';
          return t.trim().toUpperCase();
        })
        .filter((t): t is string => !!t)
    );
    return ['TODOS', ...Array.from(tipos)];
  });

  readonly vehiculosPublicos = computed(() => {
    const tipo = (this.filtroTipo() || 'TODOS').trim().toUpperCase();
    const sede = this.sedeFiltro();
    const query = this.terminoBusqueda().trim().toLowerCase();

    return this.vehiculoService
      .vehiculos()
      .filter((v) => {
        if (!sede || sede === 'TODAS') return true;
        const sUpper = sede.toUpperCase();
        const tieneUnidadDisponibleEnSede = v.unidades?.some(
          (u) => (u.sede || '').toUpperCase() === sUpper && (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE'
        );
        const coincideSedePrincipal = (v.sede || '').toUpperCase() === sUpper && (v.unidadesDisponibles ?? 0) > 0;
        return tieneUnidadDisponibleEnSede || coincideSedePrincipal;
      })
      .filter((v) => {
        if (tipo === 'TODOS') return true;
        const tipoNom = (v.tipo?.nombreTipo || (typeof v.tipo === 'string' ? v.tipo : '') || v.tipoCarroceria || '').trim().toUpperCase();
        return tipoNom === tipo;
      })
      .filter((v) => {
        const stock = v.unidadesDisponibles !== undefined
          ? v.unidadesDisponibles
          : (v.unidades ? v.unidades.filter((u) => (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE').length : 0);
        const tieneStock = stock > 0 && v.estado?.nombreEstado?.toUpperCase() === 'DISPONIBLE';
        return v.activo !== false && tieneStock;
      })
      .filter((v) => {
        if (!query) return true;
        const marca = (v.modelo?.marca?.nombreMarca || v.marca?.nombreMarca || '').toLowerCase();
        const modelo = (v.modelo?.modelo || v.nombreModelo || '').toLowerCase();
        const tipoNom = (v.tipo?.nombreTipo || (typeof v.tipo === 'string' ? v.tipo : '') || v.tipoCarroceria || '').toLowerCase();
        const combustible = (v.combustible?.nombreCombustible || '').toLowerCase();
        const anio = (v.anio || '').toString();
        const placa = (v.placa || '').toLowerCase();
        return (
          marca.includes(query) ||
          modelo.includes(query) ||
          tipoNom.includes(query) ||
          combustible.includes(query) ||
          anio.includes(query) ||
          placa.includes(query) ||
          `${marca} ${modelo}`.includes(query)
        );
      });
  });

  readonly paginaActual = signal(this.estadoInicial?.paginaActual || 1);
  readonly itemsPorPagina = 8;

  readonly totalVehiculos = computed(() => this.vehiculosPublicos().length);

  readonly totalPaginas = computed(() => Math.ceil(this.totalVehiculos() / this.itemsPorPagina) || 1);

  readonly vehiculosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.vehiculosPublicos().slice(inicio, fin);
  });

  readonly rangoInicio = computed(() => {
    if (this.totalVehiculos() === 0) return 0;
    return (this.paginaActual() - 1) * this.itemsPorPagina + 1;
  });

  readonly rangoFin = computed(() => {
    return Math.min(this.paginaActual() * this.itemsPorPagina, this.totalVehiculos());
  });

  readonly paginasArray = computed(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  private cargarEstado(): CatalogoFiltroState | null {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('paulcars_catalogo_estado') : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private guardarEstado(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const estado: CatalogoFiltroState = {
          filtroTipo: this.filtroTipo(),
          filtroEstado: this.filtroEstado(),
          paginaActual: this.paginaActual()
        };
        sessionStorage.setItem('paulcars_catalogo_estado', JSON.stringify(estado));
      }
    } catch {
      // ignore
    }
  }

  ngOnInit(): void {
    this.vehiculoService.cargar();

    this.route.queryParamMap.subscribe((params) => {
      const qSede = params.get('sede');
      if (qSede) {
        this.sedeFiltro.set(qSede.toUpperCase());
        // Al buscar desde el widget, mostramos únicamente flota disponible en esa sede
        this.filtroEstado.set('DISPONIBLE');
      }

      const qSedeDev = params.get('sedeDevolucion');
      if (qSedeDev) this.sedeDevolucionParam.set(qSedeDev.toUpperCase());

      const qFRecojo = params.get('fechaRecojo');
      if (qFRecojo) this.fechaRecojoParam.set(qFRecojo);

      const qHRecojo = params.get('horaRecojo');
      if (qHRecojo) this.horaRecojoParam.set(qHRecojo);

      const qFDev = params.get('fechaDevolucion');
      if (qFDev) this.fechaDevolucionParam.set(qFDev);

      const qHDev = params.get('horaDevolucion');
      if (qHDev) this.horaDevolucionParam.set(qHDev);

      const qDias = params.get('dias');
      if (qDias) this.diasCalculadosParam.set(Number(qDias));
    });
  }

  buscar(termino: string): void {
    this.terminoBusqueda.set(termino);
    this.paginaActual.set(1);
  }

  filtrarPorSede(sede: string): void {
    this.sedeFiltro.set(sede);
    this.paginaActual.set(1);
  }

  limpiarFiltroBusqueda(): void {
    this.terminoBusqueda.set('');
    this.filtroTipo.set('TODOS');
    this.sedeFiltro.set('TODAS');
    this.sedeDevolucionParam.set('');
    this.fechaRecojoParam.set('');
    this.horaRecojoParam.set('');
    this.fechaDevolucionParam.set('');
    this.horaDevolucionParam.set('');
    this.diasCalculadosParam.set(0);
    this.filtroEstado.set('TODOS');
    this.paginaActual.set(1);
    this.guardarEstado();
    this.router.navigate(['/catalogo']);
  }

  filtrarPorTipo(tipo: string): void {
    this.filtroTipo.set(tipo);
    this.paginaActual.set(1);
    this.guardarEstado();
  }

  filtrarPorEstado(estado: string): void {
    if (!this.esStaff()) return;
    this.filtroEstado.set(estado);
    this.paginaActual.set(1);
    this.guardarEstado();
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) {
      this.paginaActual.update((p) => p - 1);
      this.guardarEstado();
      this.scrollAlGrid();
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.update((p) => p + 1);
      this.guardarEstado();
      this.scrollAlGrid();
    }
  }

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas() && p !== this.paginaActual()) {
      this.paginaActual.set(p);
      this.guardarEstado();
      this.scrollAlGrid();
    }
  }

  private scrollAlGrid(): void {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 0);
  }

  claseEstado(estado?: string): string {
    const e = estado?.toUpperCase();
    if (e === 'DISPONIBLE') return 'badge-disponible';
    if (e === 'ALQUILADO' || e === 'NO DISPONIBLE') return 'badge-alquilado';
    if (e === 'MANTENIMIENTO') return 'badge-mantenimiento';
    return 'badge-alquilado';
  }

  iconoEstado(estado?: string): string {
    const e = estado?.toUpperCase();
    if (e === 'DISPONIBLE') return 'check_circle';
    if (e === 'ALQUILADO' || e === 'NO DISPONIBLE') return 'lock_clock';
    if (e === 'MANTENIMIENTO') return 'build';
    return 'info';
  }

  nombreSede(sede?: string): string {
    const s = (sede || '').toUpperCase();
    if (s === 'MIRAFLORES') return 'Miraflores - Av. 28 de Julio 489';
    if (s === 'AEROPUERTO') return 'Aeropuerto Internacional Jorge Chávez';
    if (s === 'TODAS' || !s) return 'las sedes seleccionadas';
    return sede || 'Sede Principal';
  }

  montoGarantiaPorTipo(tipo?: string): number {
    const t = (tipo || '').toUpperCase();
    if (t.includes('PICKUP') || t.includes('CAMIONETA')) return 7000;
    if (t.includes('SUV')) return 5000;
    if (t.includes('SEDAN') || t.includes('SEDÁN')) return 3500;
    if (t.includes('HATCHBACK')) return 2500;
    return 3500;
  }

  queryParamsParaVehiculo(vehiculoId: number) {
    return {
      vehiculoId,
      sede: this.sedeFiltro() !== 'TODAS' ? this.sedeFiltro() : undefined,
      sedeDevolucion: this.sedeDevolucionParam() || undefined,
      fechaRecojo: this.fechaRecojoParam() || undefined,
      horaRecojo: this.horaRecojoParam() || undefined,
      fechaDevolucion: this.fechaDevolucionParam() || undefined,
      horaDevolucion: this.horaDevolucionParam() || undefined,
      inicio: this.fechaRecojoParam() || undefined,
      fin: this.fechaDevolucionParam() || undefined
    };
  }
}