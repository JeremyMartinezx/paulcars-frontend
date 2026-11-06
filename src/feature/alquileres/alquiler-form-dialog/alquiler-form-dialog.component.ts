import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  provideNativeDateAdapter
} from '@angular/material/core';

import { Cliente } from '../../../core/models/cliente.model';
import { Vehiculo } from '../../../core/models/vehiculo.model';
import { ClienteService } from '../../../core/service/cliente.service';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { AlquilerCounterRequest } from '../../../core/models/alquiler.model';
import { TARIFAS, garantiaHold } from '../../../core/utils/reglas-negocio.util';
import {
  CUSTOM_DATE_FORMATS,
  CustomDateAdapter,
  calcularMinFechaDevolucion,
  calcularMinFechaRecojo,
  crearFiltroFechasSede,
  esFechaDomingo,
  formatearFechaISO,
  obtenerHorasValidasSede,
  obtenerHoyISO,
  parsearFechaISO
} from '../../../core/utils/tarifa-alquiler.util';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import { ClienteFormDialogComponent } from '../../clientes/cliente-form-dialog/cliente-form-dialog.component';

function rangoDeFechasValido(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const inicio = group.get('fechaInicio')?.value;
    const fin = group.get('fechaFin')?.value;

    if (!inicio || !fin) return null;
    return String(fin) > String(inicio) ? null : { rangoInvalido: true };
  };
}

export type NuevoAlquilerResultado = AlquilerCounterRequest;

type DropdownTipo =
  | 'cliente'
  | 'vehiculo'
  | 'recojoSede'
  | 'devolucionSede'
  | 'inicioHora'
  | 'finHora'
  | null;

@Component({
  selector: 'app-alquiler-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatDatepickerModule
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' },
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: CUSTOM_DATE_FORMATS }
  ],
  templateUrl: './alquiler-form-dialog.component.html',
  styleUrl: './alquiler-form-dialog.component.css'
})
export class AlquilerFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AlquilerFormDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly clienteService = inject(ClienteService);
  private readonly vehiculoService = inject(VehiculoService);

  readonly obtenerImagenVehiculo = obtenerImagenVehiculo;
  readonly hoyStr = obtenerHoyISO();

  readonly clientesList = signal<Cliente[]>([]);
  readonly vehiculosList = signal<Vehiculo[]>([]);
  readonly busquedaCliente = signal<string>('');
  readonly clienteSeleccionadoId = signal<number | null>(null);
  readonly vehiculoSeleccionadoId = signal<number | null>(null);

  readonly sedeRecojoSig = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');
  readonly sedeDevolucionSig = signal<'MIRAFLORES' | 'AEROPUERTO'>('MIRAFLORES');
  readonly fechaInicioSig = signal<string>('');
  readonly horaRecojoSig = signal<string>('10:00');
  readonly fechaFinSig = signal<string>('');
  readonly horaDevolucionSig = signal<string>('10:00');
  readonly dropdownAbierto = signal<DropdownTipo>(null);

  form = this.fb.group(
    {
      clienteId: [null as number | null, [Validators.required]],
      vehiculoId: [null as number | null, [Validators.required]],
      fechaInicio: ['', [Validators.required]],
      fechaFin: ['', [Validators.required]],
      sedeRecojo: ['MIRAFLORES', [Validators.required]],
      sedeDevolucion: ['MIRAFLORES', [Validators.required]],
      horaRecojo: ['10:00', [Validators.required]],
      horaDevolucion: ['10:00', [Validators.required]],
      seguroTodoRiesgo: [false],
      conductorAdicional: [false],
      sillaBebe: [false]
    },
    { validators: rangoDeFechasValido() }
  );

  readonly tarifas = TARIFAS;
  readonly totalEstimado = signal(0);
  readonly subtotalBase = signal(0);
  readonly totalExtras = signal(0);
  readonly diasCalculados = signal(0);

  readonly horasRecojo = computed(() =>
    obtenerHorasValidasSede(this.sedeRecojoSig(), this.fechaInicioSig())
  );

  readonly horasDevolucion = computed(() =>
    obtenerHorasValidasSede(this.sedeDevolucionSig(), this.fechaFinSig())
  );

  readonly minFechaInicioStr = computed(() =>
    calcularMinFechaRecojo(this.sedeRecojoSig())
  );

  readonly minFechaFinStr = computed(() =>
    calcularMinFechaDevolucion(
      this.sedeDevolucionSig(),
      this.fechaInicioSig() || this.minFechaInicioStr()
    )
  );

  readonly minFechaInicioDate = computed<Date>(() =>
    parsearFechaISO(this.minFechaInicioStr()) || new Date()
  );

  readonly minFechaFinDate = computed<Date>(() =>
    parsearFechaISO(this.minFechaFinStr()) || this.minFechaInicioDate()
  );

  readonly fechaInicioDate = computed<Date | null>(() =>
    parsearFechaISO(this.fechaInicioSig())
  );

  readonly fechaFinDate = computed<Date | null>(() =>
    parsearFechaISO(this.fechaFinSig())
  );

  readonly filtroFechasInicio = crearFiltroFechasSede(
    () => this.sedeRecojoSig(),
    () => this.minFechaInicioDate()
  );

  readonly filtroFechasFin = crearFiltroFechasSede(
    () => this.sedeDevolucionSig(),
    () => this.minFechaFinDate()
  );

  readonly vehiculoSeleccionado = computed(() => {
    const id = this.vehiculoSeleccionadoId();
    if (!id) return null;
    return this.vehiculosList().find((v) => v.idVehiculo === id) || null;
  });

  readonly clienteSeleccionado = computed(() => {
    const id = this.clienteSeleccionadoId();
    if (!id) return null;
    return this.clientesList().find((c) => c.idCliente === id) || null;
  });

  readonly clientesFiltrados = computed(() => {
    const raw = this.busquedaCliente().trim();
    const lista = this.clientesList();
    if (!raw) return lista;

    const actual = this.clienteSeleccionado();
    if (actual) {
      const etiquetaActual = `${actual.nombres} ${actual.apellidos} • DNI: ${actual.numeroDocumento}`;
      if (raw === etiquetaActual) {
        return lista;
      }
    }

    const q = raw.toLowerCase();
    return lista.filter(
      (c) =>
        (c.numeroDocumento && c.numeroDocumento.toLowerCase().includes(q)) ||
        (c.nombres && c.nombres.toLowerCase().includes(q)) ||
        (c.apellidos && c.apellidos.toLowerCase().includes(q)) ||
        `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase().includes(q)
    );
  });

  clienteTieneDatosCompletos(c: Cliente | null | undefined): boolean {
    if (!c) return false;
    const dni = (c.numeroDocumento ?? '').trim();
    const lic = (c.licenciaConducir ?? '').trim();
    return dni.length > 0 && lic.length > 0;
  }

  readonly garantiaEstimada = computed(() => garantiaHold(this.vehiculoSeleccionado()));

  constructor() {
    this.form.valueChanges.subscribe(() => {
      this.calcularTotal();
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.dropdownAbierto.set(null);
  }

  ngOnInit(): void {
    this.inicializarFechasYHorarios();

    this.clienteService.listarTodos().subscribe({
      next: (data) => this.clientesList.set(data),
      error: (err) => console.error('Error cargando clientes:', err)
    });

    this.vehiculoService.listarTodos().subscribe({
      next: (data) => {
        this.vehiculosList.set(data.filter((v) => v.estado?.nombreEstado === 'DISPONIBLE'));
      },
      error: (err) => console.error('Error cargando vehículos:', err)
    });
  }

  private inicializarFechasYHorarios(): void {
    const sedeRec = this.sedeRecojoSig();
    const sedeDev = this.sedeDevolucionSig();
    const fInicio = calcularMinFechaRecojo(sedeRec);
    this.fechaInicioSig.set(fInicio);
    this.form.controls.fechaInicio.setValue(fInicio, { emitEvent: false });

    const turnosRec = obtenerHorasValidasSede(sedeRec, fInicio);
    const hRec = turnosRec.includes('10:00') ? '10:00' : (turnosRec[0] || '09:00');
    this.horaRecojoSig.set(hRec);
    this.form.controls.horaRecojo.setValue(hRec, { emitEvent: false });

    const fFin = calcularMinFechaDevolucion(sedeDev, fInicio);
    this.fechaFinSig.set(fFin);
    this.form.controls.fechaFin.setValue(fFin, { emitEvent: false });

    const turnosDev = obtenerHorasValidasSede(sedeDev, fFin);
    const hDev = turnosDev.includes(hRec) ? hRec : (turnosDev.includes('18:00') ? '18:00' : (turnosDev[0] || '18:00'));
    this.horaDevolucionSig.set(hDev);
    this.form.controls.horaDevolucion.setValue(hDev);
  }

  toggleDropdown(tipo: DropdownTipo, event?: Event): void {
    event?.stopPropagation();
    this.dropdownAbierto.set(this.dropdownAbierto() === tipo ? null : tipo);
  }

  abrirDropdownCliente(event?: Event): void {
    event?.stopPropagation();
    this.dropdownAbierto.set('cliente');
  }

  onBusquedaClienteInput(valor: string): void {
    this.busquedaCliente.set(valor);
    this.dropdownAbierto.set('cliente');
    const actual = this.clienteSeleccionado();
    if (actual) {
      const etiquetaActual = `${actual.nombres} ${actual.apellidos} • DNI: ${actual.numeroDocumento}`;
      if (valor !== etiquetaActual) {
        this.clienteSeleccionadoId.set(null);
        this.form.controls.clienteId.setValue(null);
      }
    }
  }

  seleccionarCliente(cliente: Cliente, event?: Event): void {
    event?.stopPropagation();
    if (!this.clienteTieneDatosCompletos(cliente)) {
      return;
    }
    this.clienteSeleccionadoId.set(cliente.idCliente ?? null);
    this.form.controls.clienteId.setValue(cliente.idCliente ?? null);
    this.busquedaCliente.set(`${cliente.nombres} ${cliente.apellidos} • DNI: ${cliente.numeroDocumento}`);
    this.dropdownAbierto.set(null);
  }

  limpiarBusquedaCliente(event?: Event): void {
    event?.stopPropagation();
    this.busquedaCliente.set('');
    this.clienteSeleccionadoId.set(null);
    this.form.controls.clienteId.setValue(null);
    this.dropdownAbierto.set('cliente');
  }

  seleccionarVehiculo(vehiculo: Vehiculo, event?: Event): void {
    event?.stopPropagation();
    this.vehiculoSeleccionadoId.set(vehiculo.idVehiculo ?? null);
    this.form.controls.vehiculoId.setValue(vehiculo.idVehiculo ?? null);
    this.dropdownAbierto.set(null);
    this.calcularTotal();
  }

  esDomingo(fechaISO?: string | null): boolean {
    return esFechaDomingo(fechaISO);
  }

  seleccionarSedeRecojo(sede: 'MIRAFLORES' | 'AEROPUERTO', event?: Event): void {
    event?.stopPropagation();
    this.dropdownAbierto.set(null);
    this.sedeRecojoSig.set(sede);
    this.form.controls.sedeRecojo.setValue(sede);

    let fIni = this.fechaInicioSig();
    const minIni = calcularMinFechaRecojo(sede);
    if (!fIni || fIni < minIni || (sede === 'MIRAFLORES' && esFechaDomingo(fIni))) {
      fIni = minIni;
      this.fechaInicioSig.set(fIni);
      this.form.controls.fechaInicio.setValue(fIni);
    }

    const validas = obtenerHorasValidasSede(sede, fIni);
    if (validas.length > 0 && !validas.includes(this.horaRecojoSig())) {
      const nuevaHora = validas.includes('10:00') ? '10:00' : validas[0];
      this.horaRecojoSig.set(nuevaHora);
      this.form.controls.horaRecojo.setValue(nuevaHora);
    }

    this.asegurarFechaFinValida();
  }

  seleccionarSedeDevolucion(sede: 'MIRAFLORES' | 'AEROPUERTO', event?: Event): void {
    event?.stopPropagation();
    this.dropdownAbierto.set(null);
    this.sedeDevolucionSig.set(sede);
    this.form.controls.sedeDevolucion.setValue(sede);
    this.asegurarFechaFinValida();
  }

  onFechaInicioMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (!event.value) return;
    const fStr = formatearFechaISO(event.value);
    this.fechaInicioSig.set(fStr);
    this.form.controls.fechaInicio.setValue(fStr);
    this.form.controls.fechaInicio.markAsTouched();

    const validas = obtenerHorasValidasSede(this.sedeRecojoSig(), fStr);
    if (validas.length > 0 && !validas.includes(this.horaRecojoSig())) {
      const nuevaHora = validas.includes('10:00') ? '10:00' : validas[0];
      this.horaRecojoSig.set(nuevaHora);
      this.form.controls.horaRecojo.setValue(nuevaHora);
    }

    this.asegurarFechaFinValida();
  }

  onFechaFinMatChange(event: MatDatepickerInputEvent<Date>): void {
    if (!event.value) return;
    const fStr = formatearFechaISO(event.value);
    this.fechaFinSig.set(fStr);
    this.form.controls.fechaFin.setValue(fStr);
    this.form.controls.fechaFin.markAsTouched();

    const validas = obtenerHorasValidasSede(this.sedeDevolucionSig(), fStr);
    if (validas.length > 0 && !validas.includes(this.horaDevolucionSig())) {
      const nuevaHora = validas.includes(this.horaRecojoSig()) ? this.horaRecojoSig() : validas[0];
      this.horaDevolucionSig.set(nuevaHora);
      this.form.controls.horaDevolucion.setValue(nuevaHora);
    }
  }

  private asegurarFechaFinValida(): void {
    const minFin = calcularMinFechaDevolucion(this.sedeDevolucionSig(), this.fechaInicioSig());
    let fFin = this.fechaFinSig();
    if (!fFin || fFin < minFin || (this.sedeDevolucionSig() === 'MIRAFLORES' && esFechaDomingo(fFin))) {
      fFin = minFin;
      this.fechaFinSig.set(fFin);
      this.form.controls.fechaFin.setValue(fFin);
    }
    const validasDev = obtenerHorasValidasSede(this.sedeDevolucionSig(), fFin);
    if (validasDev.length > 0 && !validasDev.includes(this.horaDevolucionSig())) {
      const nuevaHora = validasDev.includes(this.horaRecojoSig()) ? this.horaRecojoSig() : validasDev[0];
      this.horaDevolucionSig.set(nuevaHora);
      this.form.controls.horaDevolucion.setValue(nuevaHora);
    }
  }

  seleccionarHoraRecojo(hora: string, event?: Event): void {
    event?.stopPropagation();
    this.horaRecojoSig.set(hora);
    this.form.controls.horaRecojo.setValue(hora);
    this.dropdownAbierto.set(null);
  }

  seleccionarHoraDevolucion(hora: string, event?: Event): void {
    event?.stopPropagation();
    this.horaDevolucionSig.set(hora);
    this.form.controls.horaDevolucion.setValue(hora);
    this.dropdownAbierto.set(null);
  }

  abrirNuevoCliente(): void {
    const ref = this.dialog.open(ClienteFormDialogComponent, {
      width: '560px',
      data: {}
    });

    ref.afterClosed().subscribe((nuevoClienteData: any) => {
      if (!nuevoClienteData) return;
      this.clienteService.agregar(nuevoClienteData).subscribe({
        next: (creado: Cliente) => {
          this.clientesList.update((lista) => [creado, ...lista]);
          this.seleccionarCliente(creado);
        },
        error: (err: any) => console.error('Error creando cliente:', err)
      });
    });
  }

  private calcularTotal(): void {
    const v = this.form.getRawValue();
    const vehiculo = this.vehiculosList().find((x) => x.idVehiculo === v.vehiculoId);

    if (!vehiculo || !v.fechaInicio || !v.fechaFin) {
      this.reiniciarTotales();
      return;
    }

    const t1 = new Date(v.fechaInicio + 'T00:00:00').getTime();
    const t2 = new Date(v.fechaFin + 'T00:00:00').getTime();
    if (t2 <= t1) {
      this.reiniciarTotales();
      return;
    }

    const dias = Math.max(1, Math.round((t2 - t1) / 86_400_000));
    let extrasDia = 0;
    if (v.seguroTodoRiesgo) extrasDia += this.tarifas.seguroTodoRiesgoDia;
    if (v.conductorAdicional) extrasDia += this.tarifas.conductorAdicionalDia;
    if (v.sillaBebe) extrasDia += this.tarifas.sillaBebeDia;

    const base = dias * Number(vehiculo.precioDia);
    const extras = dias * extrasDia;
    this.diasCalculados.set(dias);
    this.subtotalBase.set(base);
    this.totalExtras.set(extras);
    this.totalEstimado.set(base + extras);
  }

  private reiniciarTotales(): void {
    this.totalEstimado.set(0);
    this.subtotalBase.set(0);
    this.totalExtras.set(0);
    this.diasCalculados.set(0);
  }

  guardar(): void {
    if (
      this.form.invalid ||
      !this.clienteTieneDatosCompletos(this.clienteSeleccionado()) ||
      this.horasRecojo().length === 0 ||
      this.horasDevolucion().length === 0
    ) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    if (!v.clienteId || !v.vehiculoId || !v.fechaInicio || !v.fechaFin) return;

    const resultado: NuevoAlquilerResultado = {
      idCliente: v.clienteId,
      idVehiculo: v.vehiculoId,
      fechaInicio: v.fechaInicio,
      fechaFin: v.fechaFin,
      sedeRecojo: v.sedeRecojo ?? 'MIRAFLORES',
      sedeDevolucion: v.sedeDevolucion ?? (v.sedeRecojo ?? 'MIRAFLORES'),
      horaRecojo: v.horaRecojo ?? '10:00',
      horaDevolucion: v.horaDevolucion ?? '10:00',
      seguroTodoRiesgo: !!v.seguroTodoRiesgo,
      conductorAdicional: !!v.conductorAdicional,
      sillaBebe: !!v.sillaBebe
    };

    this.dialogRef.close(resultado);
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
