import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule, MatDatepickerInputEvent } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  provideNativeDateAdapter
} from '@angular/material/core';

import { AuthService } from '../../core/service/auth.service';
import { AlquilerService } from '../../core/service/alquiler.service';
import {
  SEDES_DISPONIBLES,
  validarHorarioSede,
  calcularPeriodo24Horas,
  CalculoTarifaPeriodo,
  obtenerHorasValidasSede,
  obtenerSiguienteFechaDisponible,
  CustomDateAdapter,
  CUSTOM_DATE_FORMATS,
  crearFiltroFechasSede
} from '../../core/utils/tarifa-alquiler.util';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatDatepickerModule
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' },
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS }
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alquilerService = inject(AlquilerService);

  readonly sedes = SEDES_DISPONIBLES;

  readonly sedeRecojo = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');
  readonly sedeDevolucion = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');

  readonly fechaRecojo = signal<string>('');
  readonly horaRecojo = signal<string>('10:00');

  readonly fechaDevolucion = signal<string>('');
  readonly horaDevolucion = signal<string>('10:00');

  readonly errorValidacion = signal<string | null>(null);

  readonly dropdownAbierto = signal<'recojoSede' | 'devolucionSede' | 'recojoHora' | 'devolucionHora' | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.cerrarDropdowns();
  }

  toggleDropdown(tipo: 'recojoSede' | 'devolucionSede' | 'recojoHora' | 'devolucionHora', event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.dropdownAbierto() === tipo) {
      this.dropdownAbierto.set(null);
    } else {
      this.dropdownAbierto.set(tipo);
    }
  }

  cerrarDropdowns(): void {
    this.dropdownAbierto.set(null);
  }

  seleccionarSedeRecojo(val: 'MIRAFLORES' | 'AEROPUERTO', event?: Event): void {
    if (event) event.stopPropagation();
    this.onSedeRecojoChange(val);
    this.cerrarDropdowns();
  }

  seleccionarSedeDevolucion(val: 'MIRAFLORES' | 'AEROPUERTO', event?: Event): void {
    if (event) event.stopPropagation();
    this.onSedeDevolucionChange(val);
    this.cerrarDropdowns();
  }

  seleccionarHoraRecojo(val: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.onHoraRecojoChange(val);
    this.cerrarDropdowns();
  }

  seleccionarHoraDevolucion(val: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.onHoraDevolucionChange(val);
    this.cerrarDropdowns();
  }

  readonly horasRecojo = computed(() => {
    return obtenerHorasValidasSede(this.sedeRecojo(), this.fechaRecojo());
  });

  readonly horasDevolucion = computed(() => {
    return obtenerHorasValidasSede(this.sedeDevolucion(), this.fechaDevolucion());
  });

  get hoyStr(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  readonly minFechaRecojo = computed(() => {
    const validasHoy = obtenerHorasValidasSede(this.sedeRecojo(), this.hoyStr);
    if (validasHoy.length === 0) {
      return obtenerSiguienteFechaDisponible(this.sedeRecojo(), this.hoyStr) || this.hoyStr;
    }
    return this.hoyStr;
  });

  readonly minFechaDevolucion = computed(() => {
    const fRecojo = this.fechaRecojo() || this.minFechaRecojo();
    if (!fRecojo) return '';
    const [y, m, d] = fRecojo.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 1); 
    if (this.sedeDevolucion() === 'MIRAFLORES' && dt.getDay() === 0) {
      dt.setDate(dt.getDate() + 1); 
    }
    return this.formatDate(dt);
  });

  readonly filtroFechasRecojo = crearFiltroFechasSede(
    () => this.sedeRecojo(),
    () => this.minFechaRecojoDate()
  );

  readonly filtroFechasDevolucion = crearFiltroFechasSede(
    () => this.sedeDevolucion(),
    () => this.minFechaDevolucionDate()
  );


  readonly minFechaRecojoDate = computed<Date>(() => {
    const s = this.minFechaRecojo();
    if (!s) return new Date();
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  });

  readonly minFechaDevolucionDate = computed<Date>(() => {
    const s = this.minFechaDevolucion();
    if (!s) return this.minFechaRecojoDate();
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  });

  readonly fechaRecojoDate = computed<Date | null>(() => {
    const s = this.fechaRecojo();
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  });

  readonly fechaDevolucionDate = computed<Date | null>(() => {
    const s = this.fechaDevolucion();
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  });

  onFechaRecojoMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) {
      const y = event.value.getFullYear();
      const m = String(event.value.getMonth() + 1).padStart(2, '0');
      const d = String(event.value.getDate()).padStart(2, '0');
      this.onFechaRecojoChange(`${y}-${m}-${d}`);
    }
  }

  onFechaDevolucionMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (event.value) {
      const y = event.value.getFullYear();
      const m = String(event.value.getMonth() + 1).padStart(2, '0');
      const d = String(event.value.getDate()).padStart(2, '0');
      this.onFechaDevolucionChange(`${y}-${m}-${d}`);
    }
  }

  ngOnInit(): void {
    
    const validasHoy = obtenerHorasValidasSede(this.sedeRecojo(), this.hoyStr);
    let fInicio = this.hoyStr;
    if (validasHoy.length === 0) {
      fInicio = obtenerSiguienteFechaDisponible(this.sedeRecojo(), this.hoyStr) || this.hoyStr;
    }

    this.fechaRecojo.set(fInicio);

    const turnosRecojo = obtenerHorasValidasSede(this.sedeRecojo(), fInicio);
    if (turnosRecojo.length > 0) {
      this.horaRecojo.set(turnosRecojo.includes('10:00') ? '10:00' : turnosRecojo[0]);
    }

    const [y, m, d] = fInicio.split('-').map(Number);
    const dFin = new Date(y, m - 1, d);
    dFin.setDate(dFin.getDate() + 2);
    if (this.sedeDevolucion() === 'MIRAFLORES' && dFin.getDay() === 0) {
      dFin.setDate(dFin.getDate() + 1);
    }
    const fFin = this.formatDate(dFin);
    this.fechaDevolucion.set(fFin);

    const turnosDev = obtenerHorasValidasSede(this.sedeDevolucion(), fFin);
    if (turnosDev.length > 0) {
      this.horaDevolucion.set(turnosDev.includes(this.horaRecojo()) ? this.horaRecojo() : turnosDev[0]);
    }

    this.ajustarHorasValidas();
    this.consultarBackendDisponibilidad('recojo');
    this.consultarBackendDisponibilidad('devolucion');
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  esDomingo(fechaStr: string): boolean {
    if (!fechaStr) return false;
    const [y, m, d] = fechaStr.split('-').map(Number);
    if (!y || !m || !d) return false;
    return new Date(y, m - 1, d).getDay() === 0;
  }

  siguienteLunes(fechaStr: string): string {
    if (!fechaStr) return fechaStr;
    const [y, m, d] = fechaStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 1);
    while (dt.getDay() === 0) {
      dt.setDate(dt.getDate() + 1);
    }
    return this.formatDate(dt);
  }

  formatearFechaCorta(fechaStr: string): string {
    if (!fechaStr) return '';
    const [y, m, d] = fechaStr.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }

  private ajustarHorasValidas(): void {
    const validasRecojo = this.horasRecojo();
    if (validasRecojo.length > 0) {
      if (!validasRecojo.includes(this.horaRecojo())) {
        this.horaRecojo.set(validasRecojo.includes('10:00') ? '10:00' : validasRecojo[0]);
      }
    } else {
      this.horaRecojo.set('');
    }

    const validasDev = this.horasDevolucion();
    if (validasDev.length > 0) {
      if (!validasDev.includes(this.horaDevolucion())) {
        this.horaDevolucion.set(validasDev.includes('10:00') ? '10:00' : validasDev[0]);
      }
    } else {
      this.horaDevolucion.set('');
    }
  }

  readonly calculoPeriodo = computed<CalculoTarifaPeriodo>(() => {
    return calcularPeriodo24Horas(
      this.fechaRecojo(),
      this.horaRecojo(),
      this.fechaDevolucion(),
      this.horaDevolucion()
    );
  });

  consultarBackendDisponibilidad(tipo: 'recojo' | 'devolucion'): void {
    const sede = tipo === 'recojo' ? this.sedeRecojo() : this.sedeDevolucion();
    const fecha = tipo === 'recojo' ? this.fechaRecojo() : this.fechaDevolucion();
    if (!sede || !fecha) return;

    this.alquilerService.obtenerDisponibilidadHorarios(sede, fecha).subscribe({
      next: (resp) => {
        if (!resp.disponible) {
          if (resp.proximaFechaDisponible) {
            if (tipo === 'recojo') {
              this.fechaRecojo.set(resp.proximaFechaDisponible);
              if (resp.proximoHorarioDisponible) {
                this.horaRecojo.set(resp.proximoHorarioDisponible);
              }
              this.asegurarFechaDevolucionCoherente();
            } else {
              this.fechaDevolucion.set(resp.proximaFechaDisponible);
              if (resp.proximoHorarioDisponible) {
                this.horaDevolucion.set(resp.proximoHorarioDisponible);
              }
            }
            this.ajustarHorasValidas();
            this.validarCamposEnTiempoReal();
          }
        }
      },
      error: (err) => {
        console.debug('Error consultando backend de disponibilidad:', err);
      }
    });
  }

  private asegurarFechaDevolucionCoherente(): void {
    if (!this.fechaRecojo()) return;

    const minDev = this.minFechaDevolucion();
    if (!this.fechaDevolucion() || this.fechaDevolucion() < minDev) {
      this.fechaDevolucion.set(minDev);
    } else if (this.sedeDevolucion() === 'MIRAFLORES' && this.esDomingo(this.fechaDevolucion())) {
      this.fechaDevolucion.set(this.siguienteLunes(this.fechaDevolucion()));
    }
  }

  onSedeRecojoChange(val: 'MIRAFLORES' | 'AEROPUERTO'): void {
    this.sedeRecojo.set(val);
    this.sedeDevolucion.set(val);

    if (val === 'MIRAFLORES') {
      if (this.esDomingo(this.fechaRecojo())) {
        const lunesRecojo = this.siguienteLunes(this.fechaRecojo());
        this.fechaRecojo.set(lunesRecojo);
      }
      if (this.esDomingo(this.fechaDevolucion())) {
        const lunesDev = this.siguienteLunes(this.fechaDevolucion());
        this.fechaDevolucion.set(lunesDev);
      }
    }

    const validas = obtenerHorasValidasSede(val, this.fechaRecojo());
    if (validas.length === 0) {
      const sig = obtenerSiguienteFechaDisponible(val, this.hoyStr);
      if (sig) {
        this.fechaRecojo.set(sig);
      }
    }

    this.asegurarFechaDevolucionCoherente();
    this.ajustarHorasValidas();
    this.validarCamposEnTiempoReal();
    this.consultarBackendDisponibilidad('recojo');
    this.consultarBackendDisponibilidad('devolucion');
  }

  onSedeDevolucionChange(val: 'MIRAFLORES' | 'AEROPUERTO'): void {
    this.sedeDevolucion.set(val);

    if (val === 'MIRAFLORES' && this.esDomingo(this.fechaDevolucion())) {
      this.fechaDevolucion.set(this.siguienteLunes(this.fechaDevolucion()));
    }

    this.ajustarHorasValidas();
    this.validarCamposEnTiempoReal();
    this.consultarBackendDisponibilidad('devolucion');
  }

  onFechaRecojoChange(val: string): void {
    if (!val) return;

    if (this.sedeRecojo() === 'MIRAFLORES' && this.esDomingo(val)) {
      val = this.siguienteLunes(val);
    }

    const validas = obtenerHorasValidasSede(this.sedeRecojo(), val);
    if (validas.length === 0 && val === this.hoyStr) {
      const sig = obtenerSiguienteFechaDisponible(this.sedeRecojo(), val);
      if (sig) {
        val = sig;
      }
    }

    this.fechaRecojo.set(val);
    this.asegurarFechaDevolucionCoherente();
    this.ajustarHorasValidas();
    this.validarCamposEnTiempoReal();
    this.consultarBackendDisponibilidad('recojo');
  }

  onHoraRecojoChange(val: string): void {
    this.horaRecojo.set(val);
    const validasDev = this.horasDevolucion();
    if (validasDev.includes(val)) {
      this.horaDevolucion.set(val);
    }
    this.validarCamposEnTiempoReal();
  }

  onFechaDevolucionChange(val: string): void {
    if (!val) return;

    if (this.sedeDevolucion() === 'MIRAFLORES' && this.esDomingo(val)) {
      val = this.siguienteLunes(val);
    }

    const minDev = this.minFechaDevolucion();
    if (val < minDev) {
      val = minDev;
    }

    this.fechaDevolucion.set(val);
    this.ajustarHorasValidas();
    this.validarCamposEnTiempoReal();
    this.consultarBackendDisponibilidad('devolucion');
  }

  onHoraDevolucionChange(val: string): void {
    this.horaDevolucion.set(val);
    this.validarCamposEnTiempoReal();
  }

  private validarCamposEnTiempoReal(): boolean {
    this.errorValidacion.set(null);

    if (!this.fechaRecojo()) {
      this.errorValidacion.set('Selecciona una fecha de recojo.');
      return false;
    }

    if (this.sedeRecojo() === 'MIRAFLORES' && this.esDomingo(this.fechaRecojo())) {
      this.errorValidacion.set('La Sede Miraflores no opera los domingos. Por favor selecciona de lunes a sábado o la sede Aeropuerto Internacional Jorge Chávez (24/7).');
      return false;
    }

    if (this.horasRecojo().length === 0) {
      if (this.fechaRecojo() === this.hoyStr) {
        this.errorValidacion.set('Las reservas para hoy requieren un mínimo de 1 hora de anticipación. Ya no quedan turnos disponibles para hoy; por favor selecciona a partir de mañana.');
      } else {
        this.errorValidacion.set('No hay turnos disponibles para la fecha de recojo seleccionada.');
      }
      return false;
    }

    if (!this.horaRecojo()) {
      this.errorValidacion.set('Selecciona una hora de recojo.');
      return false;
    }

    if (!this.fechaDevolucion()) {
      this.errorValidacion.set('Selecciona una fecha de devolución.');
      return false;
    }

    if (this.fechaDevolucion() <= this.fechaRecojo()) {
      this.errorValidacion.set('La fecha de devolución debe ser al menos un día posterior a la de recojo (mínimo 1 día de alquiler).');
      return false;
    }

    if (this.sedeDevolucion() === 'MIRAFLORES' && this.esDomingo(this.fechaDevolucion())) {
      this.errorValidacion.set('La Sede Miraflores no recibe devoluciones los domingos. Por favor selecciona de lunes a sábado o la sede Aeropuerto Internacional Jorge Chávez (24/7).');
      return false;
    }

    if (this.horasDevolucion().length === 0) {
      this.errorValidacion.set('No hay turnos disponibles para la fecha de devolución seleccionada.');
      return false;
    }

    if (!this.horaDevolucion()) {
      this.errorValidacion.set('Selecciona una hora de devolución.');
      return false;
    }

    const vRecojo = validarHorarioSede(this.sedeRecojo(), this.fechaRecojo(), this.horaRecojo());
    if (!vRecojo.valido) {
      this.errorValidacion.set(`Recojo: ${vRecojo.mensaje}`);
      return false;
    }

    const vDevolucion = validarHorarioSede(this.sedeDevolucion(), this.fechaDevolucion(), this.horaDevolucion());
    if (!vDevolucion.valido) {
      this.errorValidacion.set(`Devolución: ${vDevolucion.mensaje}`);
      return false;
    }

    const calc = this.calculoPeriodo();
    if (!calc.esPeriodoValido) {
      this.errorValidacion.set(calc.mensajeDetalle);
      return false;
    }

    return true;
  }

  buscarVehiculos(): void {
    if (!this.validarCamposEnTiempoReal()) {
      if (!this.errorValidacion()) {
        this.errorValidacion.set('Por favor completa todos los campos de recojo y devolución.');
      }
      return;
    }

    const calc = this.calculoPeriodo();

    this.router.navigate(['/catalogo'], {
      queryParams: {
        sede: this.sedeRecojo(),
        sedeDevolucion: this.sedeDevolucion(),
        fechaRecojo: this.fechaRecojo(),
        horaRecojo: this.horaRecojo(),
        fechaDevolucion: this.fechaDevolucion(),
        horaDevolucion: this.horaDevolucion(),
        dias: calc.diasCobrados
      }
    });
  }

  obtenerInfoSede(id: string) {
    return this.sedes.find((s) => s.id === id);
  }
}