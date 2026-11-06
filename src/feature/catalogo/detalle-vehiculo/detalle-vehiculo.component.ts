import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  provideNativeDateAdapter
} from '@angular/material/core';

import { VehiculoService } from '../../../core/service/vehiculo.service';
import { AuthService } from '../../../core/service/auth.service';
import { Vehiculo } from '../../../core/models/vehiculo.model';
import { obtenerGaleriaVehiculo, obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import {
  SEDES_DISPONIBLES,
  validarHorarioSede,
  calcularPeriodo24Horas,
  CalculoTarifaPeriodo,
  obtenerHorasValidasSede,
  obtenerHoyISO,
  calcularMinFechaRecojo,
  calcularMinFechaDevolucion,
  crearFiltroFechasSede,
  parsearFechaISO,
  formatearFechaISO,
  esFechaDomingo,
  CustomDateAdapter,
  CUSTOM_DATE_FORMATS
} from '../../../core/utils/tarifa-alquiler.util';

@Component({
  selector: 'app-detalle-vehiculo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatDatepickerModule
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' },
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS }
  ],
  templateUrl: './detalle-vehiculo.component.html',
  styleUrl: './detalle-vehiculo.component.css'
})
export class DetalleVehiculoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vehiculoService = inject(VehiculoService);
  private readonly authService = inject(AuthService);
  readonly obtenerImagenVehiculo = obtenerImagenVehiculo;
  readonly sedes = SEDES_DISPONIBLES;

  readonly esStaff = computed(() => {
    const r = this.authService.rolActual();
    return r === 'ADMIN' || r === 'EMPLEADO' || (r as string) === 'ASESOR';
  });

  readonly vehiculoId = signal<number>(0);
  readonly imagenActivaIndex = signal<number>(0);
  readonly copiado = signal<boolean>(false);

  readonly sedeRecojo = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');
  readonly sedeDevolucion = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');

  readonly fechaEntrega = signal<string>('');
  readonly horaEntrega = signal<string>('10:00');

  readonly fechaDevolucion = signal<string>('');
  readonly horaDevolucion = signal<string>('10:00');

  readonly errorHorario = signal<string | null>(null);

  readonly extraSeguro = signal<boolean>(false);
  readonly extraConductor = signal<boolean>(false);
  readonly extraSilla = signal<boolean>(false);

  readonly TARIFA_SEGURO_DIA = 35.00;
  readonly TARIFA_CONDUCTOR_DIA = 6.50;
  readonly TARIFA_SILLA_DIA = 6.50;

  readonly dropdownAbierto = signal<'entregaHora' | 'devolucionHora' | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.cerrarDropdowns();
  }

  toggleDropdown(tipo: 'entregaHora' | 'devolucionHora', event?: Event): void {
    if (event) event.stopPropagation();
    if (this.dropdownAbierto() === tipo) {
      this.dropdownAbierto.set(null);
    } else {
      this.dropdownAbierto.set(tipo);
    }
  }

  cerrarDropdowns(): void {
    this.dropdownAbierto.set(null);
  }

  seleccionarHoraEntrega(val: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.onHoraEntregaChange(val);
    this.cerrarDropdowns();
  }

  seleccionarHoraDevolucion(val: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.onHoraDevolucionChange(val);
    this.cerrarDropdowns();
  }

  readonly horasRecojo = computed(() => {
    return obtenerHorasValidasSede(this.sedeRecojo(), this.fechaEntrega());
  });

  readonly horasDevolucion = computed(() => {
    return obtenerHorasValidasSede(this.sedeDevolucion(), this.fechaDevolucion());
  });

  readonly hoyStr = obtenerHoyISO();

  readonly minFechaEntrega = computed(() => {
    return calcularMinFechaRecojo(this.sedeRecojo());
  });

  readonly minFechaDevolucion = computed(() => {
    const fEntrega = this.fechaEntrega() || this.minFechaEntrega();
    return calcularMinFechaDevolucion(this.sedeDevolucion(), fEntrega);
  });

  readonly minFechaEntregaDate = computed<Date>(() => {
    return parsearFechaISO(this.minFechaEntrega()) || new Date();
  });

  readonly minFechaDevolucionDate = computed<Date>(() => {
    return parsearFechaISO(this.minFechaDevolucion()) || this.minFechaEntregaDate();
  });

  readonly fechaEntregaDate = computed<Date | null>(() => {
    return parsearFechaISO(this.fechaEntrega());
  });

  readonly fechaDevolucionDate = computed<Date | null>(() => {
    return parsearFechaISO(this.fechaDevolucion());
  });

  readonly filtroFechasEntrega = crearFiltroFechasSede(
    () => this.sedeRecojo(),
    () => this.minFechaEntregaDate()
  );

  readonly filtroFechasDevolucion = crearFiltroFechasSede(
    () => this.sedeDevolucion(),
    () => this.minFechaDevolucionDate()
  );

  onFechaEntregaMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) {
      const iso = formatearFechaISO(event.value);
      this.onFechaEntregaChange(iso);
    }
  }

  onFechaDevolucionMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) {
      const iso = formatearFechaISO(event.value);
      this.onFechaDevolucionChange(iso);
    }
  }

  esDomingo(fechaStr: string): boolean {
    return esFechaDomingo(fechaStr);
  }

  get hoy(): string {
    return this.hoyStr;
  }

  ngOnInit(): void {
    this.vehiculoService.cargar();

    const hoyDate = new Date();
    const dInicio = new Date(hoyDate);
    dInicio.setDate(dInicio.getDate() + 1);
    if (dInicio.getDay() === 0) dInicio.setDate(dInicio.getDate() + 1);

    const dFin = new Date(dInicio);
    dFin.setDate(dFin.getDate() + 3);
    if (dFin.getDay() === 0) dFin.setDate(dFin.getDate() + 1);

    this.fechaEntrega.set(this.formatDate(dInicio));
    this.fechaDevolucion.set(this.formatDate(dFin));

    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) {
        this.vehiculoId.set(id);
        this.imagenActivaIndex.set(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    this.route.queryParamMap.subscribe((queryParams) => {
      const qSede = queryParams.get('sede');
      if (qSede) this.sedeRecojo.set(qSede.toUpperCase() as any);

      const qSedeDev = queryParams.get('sedeDevolucion');
      if (qSedeDev) this.sedeDevolucion.set(qSedeDev.toUpperCase() as any);
      else if (qSede) this.sedeDevolucion.set(qSede.toUpperCase() as any);

      const qInicio = queryParams.get('fechaRecojo') || queryParams.get('inicio');
      if (qInicio) this.fechaEntrega.set(qInicio);

      const qHRecojo = queryParams.get('horaRecojo');
      if (qHRecojo) this.horaEntrega.set(qHRecojo);

      const qFin = queryParams.get('fechaDevolucion') || queryParams.get('fin');
      if (qFin) this.fechaDevolucion.set(qFin);

      const qHDev = queryParams.get('horaDevolucion');
      if (qHDev) this.horaDevolucion.set(qHDev);

      this.validarHorarioSedeEnDetalle();
    });
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  readonly vehiculo = computed(() => {
    const id = this.vehiculoId();
    const v = this.vehiculoService.vehiculos().find((veh) => veh.idVehiculo === id) || null;
    if (v && v.sede && !this.route.snapshot.queryParamMap.get('sede')) {
      setTimeout(() => {
        this.sedeRecojo.set((v.sede || 'MIRAFLORES').toUpperCase() as any);
        this.sedeDevolucion.set((v.sede || 'MIRAFLORES').toUpperCase() as any);
      }, 0);
    }
    return v;
  });

  readonly colorVisual = computed(() => {
    const v = this.vehiculo();
    if (!v) return 'Gris Plata';
    const mod = (v.modelo?.modelo || v.nombreModelo || '').toLowerCase();
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

    if (v.color && !v.color.includes('/')) return v.color;
    if (v.unidades && v.unidades.length > 0 && v.unidades[0]?.color) {
      return v.unidades[0].color;
    }
    return 'Gris Plata';
  });

  readonly imagenes = computed(() => {
    return obtenerGaleriaVehiculo(this.vehiculo());
  });

  readonly imagenActual = computed(() => {
    const imgs = this.imagenes();
    const idx = this.imagenActivaIndex();
    return imgs[idx]?.url || '';
  });

  cambiarImagen(index: number): void {
    if (index >= 0 && index < this.imagenes().length) {
      this.imagenActivaIndex.set(index);
    }
  }

  anteriorImagen(): void {
    const actual = this.imagenActivaIndex();
    const total = this.imagenes().length;
    this.imagenActivaIndex.set((actual - 1 + total) % total);
  }

  siguienteImagen(): void {
    const actual = this.imagenActivaIndex();
    const total = this.imagenes().length;
    this.imagenActivaIndex.set((actual + 1) % total);
  }

  readonly capacidadPasajeros = computed(() => {
    const v = this.vehiculo();
    const tipo = v?.tipo?.nombreTipo?.toUpperCase() || '';
    if (tipo === 'SUV' && v?.modelo?.modelo?.toLowerCase().includes('outlander')) return '7 Pasajeros';
    if (tipo === 'SUV') return '5 - 7 Pasajeros';
    if (tipo === 'PICKUP') return '5 Pasajeros (Doble Cabina)';
    return '5 Pasajeros';
  });

  readonly tipoTransmision = computed(() => {
    const v = this.vehiculo();
    const tipo = v?.tipo?.nombreTipo?.toUpperCase() || '';
    if (tipo === 'PICKUP') return 'Mecánica 6 Vel. 4x4';
    return 'Automática Secuencial';
  });

  readonly capacidadMaletero = computed(() => {
    const v = this.vehiculo();
    const tipo = v?.tipo?.nombreTipo?.toUpperCase() || '';
    if (tipo === 'PICKUP') return 'Tolva amplia 1.000 Kg';
    if (tipo === 'SUV') return '3 Maletas grandes + 2 de mano';
    return '2 Maletas grandes';
  });

  readonly montoGarantia = computed(() => {
    const v = this.vehiculo();
    const t = (v?.tipo?.nombreTipo || '').toUpperCase();
    if (t.includes('PICKUP') || t.includes('CAMIONETA')) return 7000;
    if (t.includes('SUV')) return 5000;
    if (t.includes('SEDAN') || t.includes('SEDÁN')) return 3500;
    if (t.includes('HATCHBACK')) return 2500;
    return 3500;
  });

  readonly vehiculosSimilares = computed(() => {
    const actual = this.vehiculo();
    if (!actual) return [];
    return this.vehiculoService.vehiculos()
      .filter((v) => {
        if (v.idVehiculo === actual.idVehiculo) return false;
        if (v.tipo?.nombreTipo !== actual.tipo?.nombreTipo) return false;
        if (!this.esStaff()) {
          const stock = v.unidadesDisponibles !== undefined
            ? v.unidadesDisponibles
            : (v.unidades ? v.unidades.filter((u) => (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE').length : 0);
          if (v.activo === false || stock <= 0 || v.estado?.nombreEstado?.toUpperCase() !== 'DISPONIBLE') return false;
        }
        return true;
      })
      .slice(0, 3);
  });

  readonly periodoCalculado = computed<CalculoTarifaPeriodo>(() => {
    return calcularPeriodo24Horas(
      this.fechaEntrega(),
      this.horaEntrega(),
      this.fechaDevolucion(),
      this.horaDevolucion()
    );
  });

  readonly diasCalculados = computed(() => {
    const calc = this.periodoCalculado();
    return calc.esPeriodoValido ? calc.diasCobrados : 0;
  });

  readonly subtotalVehiculo = computed(() => {
    const v = this.vehiculo();
    const dias = this.diasCalculados();
    return (v?.precioDia ?? 0) * dias;
  });

  readonly totalExtrasPorDia = computed(() => {
    let diario = 0;
    if (this.extraSeguro()) diario += this.TARIFA_SEGURO_DIA;
    if (this.extraConductor()) diario += this.TARIFA_CONDUCTOR_DIA;
    if (this.extraSilla()) diario += this.TARIFA_SILLA_DIA;
    return diario;
  });

  readonly totalExtras = computed(() => {
    return this.totalExtrasPorDia() * this.diasCalculados();
  });

  readonly granTotal = computed(() => {
    return this.subtotalVehiculo() + this.totalExtras();
  });

  validarHorarioSedeEnDetalle(): boolean {
    this.errorHorario.set(null);

    const vRecojo = validarHorarioSede(this.sedeRecojo(), this.fechaEntrega(), this.horaEntrega());
    if (!vRecojo.valido) {
      this.errorHorario.set(`Recojo: ${vRecojo.mensaje}`);
      return false;
    }

    const vDevolucion = validarHorarioSede(this.sedeDevolucion(), this.fechaDevolucion(), this.horaDevolucion());
    if (!vDevolucion.valido) {
      this.errorHorario.set(`Devolución: ${vDevolucion.mensaje}`);
      return false;
    }

    const calc = this.periodoCalculado();
    if (!calc.esPeriodoValido) {
      this.errorHorario.set(calc.mensajeDetalle);
      return false;
    }

    return true;
  }

  onSedeRecojoChange(val: 'MIRAFLORES' | 'AEROPUERTO'): void {
    this.sedeRecojo.set(val);
    if (val === 'MIRAFLORES' && this.esDomingo(this.fechaEntrega())) {
      this.fechaEntrega.set(this.minFechaEntrega());
    }
    const horas = obtenerHorasValidasSede(val, this.fechaEntrega());
    if (horas.length > 0 && !horas.includes(this.horaEntrega())) {
      this.horaEntrega.set(horas[0]);
    }
    this.validarHorarioSedeEnDetalle();
  }

  onSedeDevolucionChange(val: 'MIRAFLORES' | 'AEROPUERTO'): void {
    this.sedeDevolucion.set(val);
    if (val === 'MIRAFLORES' && this.esDomingo(this.fechaDevolucion())) {
      this.fechaDevolucion.set(this.minFechaDevolucion());
    }
    const horas = obtenerHorasValidasSede(val, this.fechaDevolucion());
    if (horas.length > 0 && !horas.includes(this.horaDevolucion())) {
      this.horaDevolucion.set(horas[0]);
    }
    this.validarHorarioSedeEnDetalle();
  }

  onFechaEntregaChange(val: string): void {
    this.fechaEntrega.set(val);
    if (!this.fechaDevolucion() || this.fechaDevolucion() <= val) {
      this.fechaDevolucion.set(calcularMinFechaDevolucion(this.sedeDevolucion(), val));
    }
    const horas = obtenerHorasValidasSede(this.sedeRecojo(), val);
    if (horas.length > 0 && !horas.includes(this.horaEntrega())) {
      this.horaEntrega.set(horas[0]);
    }
    this.validarHorarioSedeEnDetalle();
  }

  onHoraEntregaChange(val: string): void {
    this.horaEntrega.set(val);
    this.validarHorarioSedeEnDetalle();
  }

  onFechaDevolucionChange(val: string): void {
    this.fechaDevolucion.set(val);
    const horas = obtenerHorasValidasSede(this.sedeDevolucion(), val);
    if (horas.length > 0 && !horas.includes(this.horaDevolucion())) {
      this.horaDevolucion.set(horas[0]);
    }
    this.validarHorarioSedeEnDetalle();
  }

  onHoraDevolucionChange(val: string): void {
    this.horaDevolucion.set(val);
    this.validarHorarioSedeEnDetalle();
  }

  iniciarReserva(): void {
    const v = this.vehiculo();
    if (!v) return;

    if (!this.validarHorarioSedeEnDetalle()) {
      return;
    }

    this.router.navigate(['/reservar'], {
      queryParams: {
        vehiculoId: v.idVehiculo,
        inicio: this.fechaEntrega(),
        horaRecojo: this.horaEntrega(),
        fin: this.fechaDevolucion(),
        horaDevolucion: this.horaDevolucion(),
        sedeRecojo: this.sedeRecojo(),
        sedeDevolucion: this.sedeDevolucion(),
        dias: this.diasCalculados(),
        seguro: this.extraSeguro() ? 1 : 0,
        conductor: this.extraConductor() ? 1 : 0,
        silla: this.extraSilla() ? 1 : 0
      }
    });
  }

  compartirVehiculo(): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    }
  }
}
