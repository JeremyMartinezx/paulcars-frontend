import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  provideNativeDateAdapter
} from '@angular/material/core';

import { AlquilerService } from '../../../core/service/alquiler.service';
import { AuthService } from '../../../core/service/auth.service';
import { ClienteService } from '../../../core/service/cliente.service';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { Vehiculo } from '../../../core/models/vehiculo.model';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
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
  selector: 'app-reserva-publica',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatDatepickerModule],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' },
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS }
  ],
  templateUrl: './reserva-publica.component.html',
  styleUrl: './reserva-publica.component.css'
})
export class ReservaPublicaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly vehiculoService = inject(VehiculoService);
  private readonly clienteService = inject(ClienteService);
  private readonly alquilerService = inject(AlquilerService);
  readonly authService = inject(AuthService);
  readonly esUsuarioAutenticado = computed(() => this.authService.estaAutenticado());
  readonly sedes = SEDES_DISPONIBLES;

  readonly enviado = signal(false);
  readonly cargando = signal(false);
  readonly errorMensaje = signal<string | null>(null);
  readonly resumen = signal<{
    vehiculo: string;
    sedeRecojo: string;
    sedeDevolucion: string;
    inicio: string;
    fin: string;
    cliente: string;
    total: number;
    dias: number;
    email?: string;
    dni?: string;
    eraPublico?: boolean;
  } | null>(null);

  readonly vehiculoId = signal<number>(0);
  readonly fechaInicio = signal<string>('');
  readonly horaInicio = signal<string>('10:00');
  readonly fechaFin = signal<string>('');
  readonly horaFin = signal<string>('10:00');

  readonly sedeRecojo = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');
  readonly sedeDevolucion = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');

  readonly dropdownAbierto = signal<'inicioHora' | 'finHora' | null>(null);

  readonly extraSeguro = signal<boolean>(false);
  readonly extraConductor = signal<boolean>(false);
  readonly extraSilla = signal<boolean>(false);

  readonly TARIFA_SEGURO_DIA = 35.00;
  readonly TARIFA_CONDUCTOR_DIA = 6.50;
  readonly TARIFA_SILLA_DIA = 6.50;

  readonly editandoVehiculoFechas = signal<boolean>(false);
  readonly editandoCliente = signal<boolean>(false);

  readonly clientePerfilCargado = signal<boolean>(false);
  readonly idClienteAutenticado = signal<number | null>(null);

  readonly tieneVehiculoYFechas = computed(() => {
    return this.vehiculoId() > 0 && !!this.fechaInicio() && !!this.fechaFin() && !!this.vehiculoSeleccionado();
  });

  readonly datosClienteCompletos = computed(() => {
    if (!this.esUsuarioAutenticado()) return false;
    this.clientePerfilCargado();
    return !!(
      this.reserva.nombres &&
      this.reserva.apellidos &&
      this.reserva.dni &&
      !this.reserva.dni.startsWith('PEND-') &&
      this.reserva.licencia &&
      this.reserva.direccion
    );
  });

  toggleEdicionVehiculoFechas(): void {
    this.editandoVehiculoFechas.update(v => !v);
  }

  toggleEdicionCliente(): void {
    this.editandoCliente.update(v => !v);
  }

  formatearFechaVisual(iso?: string): string {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  }

  nombreSede(sede?: string): string {
    const s = (sede || '').toUpperCase();
    if (s === 'AEROPUERTO') return 'Aeropuerto Internacional Jorge Chávez (24/7)';
    return 'Sede Miraflores (Av. 28 de Julio 489)';
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.cerrarDropdowns();
  }

  toggleDropdown(tipo: 'inicioHora' | 'finHora', event?: Event): void {
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

  seleccionarHoraInicio(val: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.horaInicio.set(val);
    this.cerrarDropdowns();
  }

  seleccionarHoraFin(val: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.horaFin.set(val);
    this.cerrarDropdowns();
  }

  readonly horasRecojo = computed(() => {
    return obtenerHorasValidasSede(this.sedeRecojo(), this.fechaInicio());
  });

  readonly horasDevolucion = computed(() => {
    return obtenerHorasValidasSede(this.sedeDevolucion(), this.fechaFin());
  });

  readonly hoyStr = obtenerHoyISO();

  get hoy(): string {
    return this.hoyStr;
  }

  readonly minFechaInicio = computed(() => {
    return calcularMinFechaRecojo(this.sedeRecojo());
  });

  readonly minFechaFin = computed(() => {
    const fInicio = this.fechaInicio() || this.minFechaInicio();
    return calcularMinFechaDevolucion(this.sedeDevolucion(), fInicio);
  });

  readonly minFechaInicioDate = computed<Date>(() => {
    return parsearFechaISO(this.minFechaInicio()) || new Date();
  });

  readonly minFechaFinDate = computed<Date>(() => {
    return parsearFechaISO(this.minFechaFin()) || this.minFechaInicioDate();
  });

  readonly fechaInicioDate = computed<Date | null>(() => {
    return parsearFechaISO(this.fechaInicio());
  });

  readonly fechaFinDate = computed<Date | null>(() => {
    return parsearFechaISO(this.fechaFin());
  });

  readonly filtroFechasInicio = crearFiltroFechasSede(
    () => this.sedeRecojo(),
    () => this.minFechaInicioDate()
  );

  readonly filtroFechasFin = crearFiltroFechasSede(
    () => this.sedeDevolucion(),
    () => this.minFechaFinDate()
  );

  onFechaInicioMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) {
      const iso = formatearFechaISO(event.value);
      this.onFechaInicioChange(iso);
    }
  }

  onFechaFinMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) {
      const iso = formatearFechaISO(event.value);
      this.onFechaFinChange(iso);
    }
  }

  esDomingo(fechaStr: string): boolean {
    return esFechaDomingo(fechaStr);
  }


  ngOnInit(): void {
    this.vehiculoService.cargar();
    this.route.queryParamMap.subscribe((params) => {
      const qId = Number(params.get('vehiculoId'));
      if (qId) {
        this.vehiculoId.set(qId);
      }
      const qInicio = params.get('inicio') || params.get('fechaInicio');
      if (qInicio) {
        this.fechaInicio.set(qInicio);
      }
      const qHInicio = params.get('horaRecojo');
      if (qHInicio) {
        this.horaInicio.set(qHInicio);
      }
      const qFin = params.get('fin') || params.get('fechaFin');
      if (qFin) {
        this.fechaFin.set(qFin);
      }
      const qHFin = params.get('horaDevolucion');
      if (qHFin) {
        this.horaFin.set(qHFin);
      }
      const qSedeR = params.get('sedeRecojo') || params.get('sede');
      if (qSedeR) {
        this.sedeRecojo.set(qSedeR.toUpperCase() as any);
      }
      const qSedeD = params.get('sedeDevolucion');
      if (qSedeD) {
        this.sedeDevolucion.set(qSedeD.toUpperCase() as any);
      } else if (qSedeR) {
        this.sedeDevolucion.set(qSedeR.toUpperCase() as any);
      }
      const qSeguro = params.get('seguro');
      if (qSeguro !== null) {
        this.extraSeguro.set(qSeguro === '1' || qSeguro === 'true');
      }
      const qConductor = params.get('conductor');
      if (qConductor !== null) {
        this.extraConductor.set(qConductor === '1' || qConductor === 'true');
      }
      const qSilla = params.get('silla');
      if (qSilla !== null) {
        this.extraSilla.set(qSilla === '1' || qSilla === 'true');
      }
    });

    if (this.authService.estaAutenticado()) {
      const u = this.authService.usuarioActual();
      if (u?.username && u.username.includes('@')) {
        this.reserva.email = u.username;
      }
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('paulcars_perfil_cliente') : null;
      if (stored) {
        try {
          const p = JSON.parse(stored);
          const emailCoincide = !u?.username?.includes('@') || p?.email === u?.username;
          if (emailCoincide) {
            if (p?.idCliente) this.idClienteAutenticado.set(p.idCliente);
            if (p?.nombres) this.reserva.nombres = p.nombres;
            if (p?.apellidos) this.reserva.apellidos = p.apellidos;
            if (p?.email) this.reserva.email = p.email;
            if (p?.telefono) this.reserva.telefono = p.telefono;
            if (p?.numeroDocumento) this.reserva.dni = p.numeroDocumento;
            if (p?.licenciaConducir) this.reserva.licencia = p.licenciaConducir;
            if (p?.direccion) this.reserva.direccion = p.direccion;
            this.clientePerfilCargado.set(true);
          }
        } catch (e) {}
      }
      this.clienteService.obtenerMiPerfil().subscribe({
        next: (perfil) => {
          if (perfil) {
            if (perfil.idCliente) this.idClienteAutenticado.set(perfil.idCliente);
            if (perfil.nombres && !perfil.nombres.toLowerCase().includes('cliente')) this.reserva.nombres = perfil.nombres.trim();
            if (perfil.apellidos && !perfil.apellidos.toLowerCase().includes('por completar')) this.reserva.apellidos = perfil.apellidos.trim();
            if (perfil.email) this.reserva.email = perfil.email.trim();
            this.reserva.telefono = (perfil.telefono && perfil.telefono !== '000000000' && perfil.telefono !== '999999999') ? perfil.telefono.trim() : '';
            this.reserva.dni = (perfil.numeroDocumento && !perfil.numeroDocumento.startsWith('PEND-') && perfil.numeroDocumento !== '00000000') ? perfil.numeroDocumento.trim() : '';
            this.reserva.licencia = perfil.licenciaConducir ? perfil.licenciaConducir.trim() : '';
            this.reserva.direccion = perfil.direccion ? perfil.direccion.trim() : '';
            this.clientePerfilCargado.set(true);
            try {
              localStorage.setItem('paulcars_perfil_cliente', JSON.stringify(perfil));
            } catch (e) {}
          }
        },
        error: () => {}
      });
    }
  }

  readonly obtenerImagenVehiculo = obtenerImagenVehiculo;

  readonly vehiculosDisponibles = computed(() =>
    this.vehiculoService.vehiculos().filter((vehiculo) => {
      const stock = vehiculo.unidadesDisponibles !== undefined
        ? vehiculo.unidadesDisponibles
        : (vehiculo.unidades ? vehiculo.unidades.filter((u) => (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE').length : 0);
      return vehiculo.activo !== false && stock > 0 && vehiculo.estado?.nombreEstado?.toUpperCase() === 'DISPONIBLE';
    })
  );

  readonly sinStockSeleccionado = computed(() => {
    const v = this.vehiculoSeleccionado();
    if (!v) return false;
    const stock = v.unidadesDisponibles !== undefined
      ? v.unidadesDisponibles
      : (v.unidades ? v.unidades.filter((u) => (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE').length : 0);
    return stock <= 0 || v.estado?.nombreEstado?.toUpperCase() !== 'DISPONIBLE';
  });

  reserva = {
    nombres: '',
    apellidos: '',
    dni: '',
    licencia: '',
    email: '',
    telefono: '',
    direccion: ''
  };

  readonly vehiculoSeleccionado = computed(() => {
    const id = this.vehiculoId();
    const v = this.vehiculosDisponibles().find((vehiculo) => vehiculo.idVehiculo === id);
    if (v && v.sede && !this.route.snapshot.queryParamMap.get('sedeRecojo')) {
      setTimeout(() => {
        this.sedeRecojo.set((v.sede || 'MIRAFLORES').toUpperCase() as any);
        this.sedeDevolucion.set((v.sede || 'MIRAFLORES').toUpperCase() as any);
      }, 0);
    }
    return v;
  });

  readonly periodoCalculado = computed<CalculoTarifaPeriodo>(() => {
    return calcularPeriodo24Horas(
      this.fechaInicio(),
      this.horaInicio(),
      this.fechaFin(),
      this.horaFin()
    );
  });

  readonly diasCalculados = computed(() => {
    const calc = this.periodoCalculado();
    return calc.esPeriodoValido ? calc.diasCobrados : 0;
  });

  readonly subtotalBase = computed(() => {
    const vehiculo = this.vehiculoSeleccionado();
    const dias = this.diasCalculados();
    if (!vehiculo || dias <= 0) return 0;
    return dias * (vehiculo.precioDia ?? 0);
  });

  readonly costoSeguroTotal = computed(() => {
    return this.extraSeguro() ? this.TARIFA_SEGURO_DIA * this.diasCalculados() : 0;
  });

  readonly costoConductorTotal = computed(() => {
    return this.extraConductor() ? this.TARIFA_CONDUCTOR_DIA * this.diasCalculados() : 0;
  });

  readonly costoSillaTotal = computed(() => {
    return this.extraSilla() ? this.TARIFA_SILLA_DIA * this.diasCalculados() : 0;
  });

  readonly totalExtras = computed(() => {
    return this.costoSeguroTotal() + this.costoConductorTotal() + this.costoSillaTotal();
  });

  readonly totalEstimado = computed(() => {
    return this.subtotalBase() + this.totalExtras();
  });

  readonly montoGarantia = computed(() => {
    const v = this.vehiculoSeleccionado();
    const t = (v?.tipo?.nombreTipo || '').toUpperCase();
    if (t.includes('PICKUP') || t.includes('CAMIONETA')) return 7000;
    if (t.includes('SUV')) return 5000;
    if (t.includes('SEDAN') || t.includes('SEDÁN')) return 3500;
    if (t.includes('HATCHBACK')) return 2500;
    return 3500;
  });

  onVehiculoChange(nuevoId: any): void {
    const id = Number(nuevoId);
    this.vehiculoId.set(id);
    const v = this.vehiculosDisponibles().find(x => x.idVehiculo === id);
    if (v && v.sede && !this.route.snapshot.queryParamMap.get('sedeRecojo')) {
      this.onSedeRecojoChange(v.sede.toUpperCase() as any);
      this.onSedeDevolucionChange(v.sede.toUpperCase() as any);
    }
  }

  onSedeRecojoChange(val: 'MIRAFLORES' | 'AEROPUERTO'): void {
    this.sedeRecojo.set(val);
    if (val === 'MIRAFLORES' && this.esDomingo(this.fechaInicio())) {
      this.fechaInicio.set(this.minFechaInicio());
    }
    const horas = obtenerHorasValidasSede(val, this.fechaInicio());
    if (horas.length > 0 && !horas.includes(this.horaInicio())) {
      this.horaInicio.set(horas[0]);
    }
  }

  onSedeDevolucionChange(val: 'MIRAFLORES' | 'AEROPUERTO'): void {
    this.sedeDevolucion.set(val);
    if (val === 'MIRAFLORES' && this.esDomingo(this.fechaFin())) {
      this.fechaFin.set(this.minFechaFin());
    }
    const horas = obtenerHorasValidasSede(val, this.fechaFin());
    if (horas.length > 0 && !horas.includes(this.horaFin())) {
      this.horaFin.set(horas[0]);
    }
  }

  onFechaInicioChange(nuevaFecha: string): void {
    this.fechaInicio.set(nuevaFecha);
    if (!this.fechaFin() || this.fechaFin() <= nuevaFecha) {
      this.fechaFin.set(calcularMinFechaDevolucion(this.sedeDevolucion(), nuevaFecha));
    }
    const horas = obtenerHorasValidasSede(this.sedeRecojo(), nuevaFecha);
    if (horas.length > 0 && !horas.includes(this.horaInicio())) {
      this.horaInicio.set(horas[0]);
    }
  }

  onFechaFinChange(nuevaFecha: string): void {
    this.fechaFin.set(nuevaFecha);
    const horas = obtenerHorasValidasSede(this.sedeDevolucion(), nuevaFecha);
    if (horas.length > 0 && !horas.includes(this.horaFin())) {
      this.horaFin.set(horas[0]);
    }
  }


  onDniInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 8);
    this.reserva.dni = clean;
    input.value = clean;
  }

  onTelefonoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 9);
    this.reserva.telefono = clean;
    input.value = clean;
  }

  onLicenciaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
    this.reserva.licencia = val;
    input.value = val;
  }

  registrar(form: NgForm): void {
    this.errorMensaje.set(null);

    const vehiculo = this.vehiculoSeleccionado();
    const total = this.totalEstimado();
    const dias = this.diasCalculados();

    if (!vehiculo) {
      this.errorMensaje.set('Por favor, selecciona un vehículo disponible.');
      return;
    }
    if (this.sinStockSeleccionado()) {
      this.errorMensaje.set('El modelo seleccionado no cuenta con unidades físicas disponibles en este momento. Por favor selecciona otro vehículo.');
      return;
    }
    if (!this.fechaInicio() || !this.fechaFin()) {
      this.errorMensaje.set('Por favor, selecciona las fechas de alquiler.');
      return;
    }
    if (this.fechaFin() < this.fechaInicio()) {
      this.errorMensaje.set('La fecha de devolución no puede ser anterior a la fecha de inicio.');
      return;
    }
    if (total <= 0) {
      this.errorMensaje.set('El total estimado debe ser mayor a 0.');
      return;
    }

    const vRecojo = validarHorarioSede(this.sedeRecojo(), this.fechaInicio(), this.horaInicio());
    if (!vRecojo.valido) {
      this.errorMensaje.set(`Oficina de entrega: ${vRecojo.mensaje}`);
      return;
    }

    const vDevolucion = validarHorarioSede(this.sedeDevolucion(), this.fechaFin(), this.horaFin());
    if (!vDevolucion.valido) {
      this.errorMensaje.set(`Oficina de devolución: ${vDevolucion.mensaje}`);
      return;
    }

    if (!this.esUsuarioAutenticado()) {
      if (form.invalid) {
        form.control.markAllAsTouched();
        this.errorMensaje.set('Por favor completa todos los campos obligatorios del cliente.');
        return;
      }
      if (!this.reserva.nombres?.trim() || !this.reserva.apellidos?.trim()) {
        this.errorMensaje.set('Por favor completa tus nombres y apellidos.');
        return;
      }
      if (!this.reserva.direccion?.trim()) {
        this.errorMensaje.set('Por favor ingresa tu dirección.');
        return;
      }
      const dniLimpio = this.reserva.dni.trim();
      if (!/^\d{8}$/.test(dniLimpio)) {
        this.errorMensaje.set('El DNI debe tener exactamente 8 dígitos numéricos.');
        return;
      }
      const telLimpio = this.reserva.telefono.trim();
      if (!/^9\d{8}$/.test(telLimpio)) {
        this.errorMensaje.set('El número de celular debe comenzar con 9 y tener 9 dígitos.');
        return;
      }
      const emailLimpio = this.reserva.email.trim();
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailLimpio)) {
        this.errorMensaje.set('Ingresa un correo electrónico válido (ej: juan@gmail.com).');
        return;
      }
      const licenciaLimpia = this.reserva.licencia.trim();
      if (!licenciaLimpia || !/^[A-Za-z]\d{8}$/.test(licenciaLimpia)) {
        this.errorMensaje.set('Número de licencia de conducir no válido.');
        return;
      }
    } else {
      const u = this.authService.usuarioActual();
      if (!this.reserva.nombres?.trim() && u?.nombre) {
        this.reserva.nombres = u.nombre.trim().split(/\s+/)[0];
      }
      if (!this.reserva.apellidos?.trim() && u?.nombre && u.nombre.trim().split(/\s+/).length > 1) {
        this.reserva.apellidos = u.nombre.trim().split(/\s+/).slice(1).join(' ');
      }
      const dniLimpio = (this.reserva.dni || '').trim();
      const licLimpia = (this.reserva.licencia || '').trim();
      const dirLimpia = (this.reserva.direccion || '').trim();
      if (!dniLimpio || dniLimpio.startsWith('PEND-') || !licLimpia || !dirLimpia) {
        this.errorMensaje.set('Debes registrar tu Documento de Identidad (DNI), Licencia de Conducir y Dirección en Mi Perfil antes de solicitar una reserva.');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
    }

    if (!vehiculo) return;

    this.cargando.set(true);

    const licenciaFinal = (this.reserva.licencia || '').trim();
    const inicioSeleccionado = this.fechaInicio();
    const finSeleccionada = this.fechaFin();
    const horaRecojoVal = this.horaInicio();
    const horaDevolucionVal = this.horaFin();
    const sedeRecojoVal = this.sedeRecojo();
    const sedeDevolucionVal = this.sedeDevolucion();

    const subtotalBaseVal = this.subtotalBase();
    const totalExtrasVal = this.totalExtras();
    const extrasList: string[] = [];
    if (this.extraSeguro()) extrasList.push('Seguro Todo Riesgo');
    if (this.extraConductor()) extrasList.push('Conductor Adicional');
    if (this.extraSilla()) extrasList.push('Silla para Bebé');
    const extrasTextoVal = extrasList.length > 0 ? extrasList.join(', ') : 'Ninguno';

    const emailFinal = (this.reserva.email || '').trim();
    const dniFinal = (this.reserva.dni || '').trim();
    const eraPublico = !this.esUsuarioAutenticado();

    const enviarAlquilerConClienteId = (idClienteFinal: number) => {
      this.alquilerService.agregar(
        idClienteFinal,
        vehiculo.idVehiculo!,
        inicioSeleccionado,
        finSeleccionada,
        sedeRecojoVal,
        sedeDevolucionVal,
        horaRecojoVal,
        horaDevolucionVal,
        dias,
        subtotalBaseVal,
        totalExtrasVal,
        total,
        extrasTextoVal
      ).subscribe({
        next: () => {
          this.cargando.set(false);
          this.resumen.set({
            vehiculo: `${vehiculo.modelo?.marca?.nombreMarca} ${vehiculo.modelo?.modelo}`,
            sedeRecojo: sedeRecojoVal === 'AEROPUERTO' ? 'Aeropuerto Internacional Jorge Chávez (24/7)' : 'Sede Miraflores (Av. 28 de Julio 489)',
            sedeDevolucion: sedeDevolucionVal === 'AEROPUERTO' ? 'Aeropuerto Internacional Jorge Chávez (24/7)' : 'Sede Miraflores (Av. 28 de Julio 489)',
            inicio: `${inicioSeleccionado} (${horaRecojoVal} hrs)`,
            fin: `${finSeleccionada} (${horaDevolucionVal} hrs)`,
            cliente: `${this.reserva.nombres} ${this.reserva.apellidos}`,
            total: total,
            dias: dias,
            email: emailFinal,
            dni: dniFinal,
            eraPublico: eraPublico
          });
          this.enviado.set(true);
          form.resetForm();
          this.fechaInicio.set('');
          this.fechaFin.set('');
          this.vehiculoId.set(0);
          if (typeof document !== 'undefined') {
            (document.activeElement as HTMLElement)?.blur();
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
          }
          if (typeof window !== 'undefined') {
            window.scrollTo(0, 0);
            setTimeout(() => {
              window.scrollTo(0, 0);
              if (typeof document !== 'undefined') {
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                const el = document.getElementById('mensaje-exito-reserva') || document.querySelector('.reserva-header');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }
            }, 50);
            setTimeout(() => {
              window.scrollTo(0, 0);
              if (typeof document !== 'undefined') {
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
              }
            }, 250);
          }
        },
        error: (err) => {
          this.cargando.set(false);
          console.error('Error al registrar alquiler:', err);
          const msg = err.error?.message || 'El vehículo no está disponible en esas fechas o ya tiene un alquiler activo.';
          this.errorMensaje.set(msg);
        }
      });
    };

    if (this.esUsuarioAutenticado() && this.idClienteAutenticado()) {
      enviarAlquilerConClienteId(this.idClienteAutenticado()!);
      return;
    }

    if (this.esUsuarioAutenticado()) {
      this.clienteService.obtenerMiPerfil().subscribe({
        next: (perfil) => {
          if (perfil && perfil.idCliente) {
            this.idClienteAutenticado.set(perfil.idCliente);
            enviarAlquilerConClienteId(perfil.idCliente);
          } else {
            this.registrarClienteYAlquilar(enviarAlquilerConClienteId);
          }
        },
        error: () => {
          this.registrarClienteYAlquilar(enviarAlquilerConClienteId);
        }
      });
      return;
    }

    this.registrarClienteYAlquilar(enviarAlquilerConClienteId);
  }

  private registrarClienteYAlquilar(enviarAlquilerFn: (idCli: number) => void): void {
    const licenciaFinal = (this.reserva.licencia || '').trim();
    this.clienteService.agregar({
      nombres: this.reserva.nombres.trim(),
      apellidos: this.reserva.apellidos.trim(),
      email: this.reserva.email.trim(),
      telefono: this.reserva.telefono.trim(),
      tipoDocumento: 'DNI',
      numeroDocumento: this.reserva.dni.trim(),
      licenciaConducir: licenciaFinal,
      direccion: this.reserva.direccion ? this.reserva.direccion.trim() : ''
    }).subscribe({
      next: (cliente) => {
        if (cliente && cliente.idCliente) {
          this.idClienteAutenticado.set(cliente.idCliente);
          enviarAlquilerFn(cliente.idCliente);
        } else {
          this.cargando.set(false);
          this.errorMensaje.set('No se pudo obtener el identificador del cliente.');
        }
      },
      error: (err) => {
        this.cargando.set(false);
        console.error('Error al registrar cliente:', err);
        const msg = err.error?.message || 'Error al validar los datos del cliente. Verifica el DNI y correo.';
        this.errorMensaje.set(msg);
      }
    });
  }
}
