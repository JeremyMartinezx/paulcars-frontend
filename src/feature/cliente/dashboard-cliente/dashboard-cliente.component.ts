import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AlquilerService } from '../../../core/service/alquiler.service';
import { AuthService } from '../../../core/service/auth.service';
import { ClienteService } from '../../../core/service/cliente.service';
import { PagoService } from '../../../core/service/pago.service';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { Alquiler } from '../../../core/models/alquiler.model';
import { Cliente } from '../../../core/models/cliente.model';
import { Vehiculo } from '../../../core/models/vehiculo.model';
import { obtenerImagenVehiculo } from '../../../core/data/vehiculo-galerias.data';
import {
  formatearCodigoAlquiler,
  LiquidacionAlquiler,
  obtenerLiquidacionAlquiler
} from '../../../core/utils/reglas-negocio.util';
import { ActaLiquidacionDialogComponent } from '../../alquileres/acta-liquidacion-dialog/acta-liquidacion-dialog.component';

export type { LiquidacionAlquiler };

@Component({
  selector: 'app-dashboard-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatDialogModule, MatIconModule, MatTooltipModule],
  templateUrl: './dashboard-cliente.component.html',
  styleUrl: './dashboard-cliente.component.css'
})
export class DashboardClienteComponent implements OnInit {
  private readonly vehiculoService = inject(VehiculoService);
  private readonly alquilerService = inject(AlquilerService);
  private readonly clienteService = inject(ClienteService);
  private readonly pagoService = inject(PagoService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly pestanaActiva = signal<'alquileres' | 'perfil'>('alquileres');
  readonly paginaActual = signal<number>(1);
  readonly tamanoPagina = signal<number>(4);
  readonly alquilerSeleccionado = signal<Alquiler | null>(null);
  readonly formatearCodigoAlquiler = formatearCodigoAlquiler;

  readonly perfilCliente = signal<Cliente | null>(null);
  readonly cargandoPerfil = signal<boolean>(false);
  readonly guardandoPerfil = signal<boolean>(false);
  readonly editandoPerfil = signal<boolean>(false);
  readonly mensajeExitoPerfil = signal<string | null>(null);
  readonly mensajeErrorPerfil = signal<string | null>(null);

  readonly modalPasswordAbierto = signal<boolean>(false);
  readonly modoPasswordOlvidado = signal<boolean>(false);
  readonly enviandoCodigo = signal<boolean>(false);
  readonly codigoEnviadoExito = signal<boolean>(false);
  readonly codigoDemoVisual = signal<string | null>(null);
  readonly guardandoPassword = signal<boolean>(false);
  readonly errorPassword = signal<string | null>(null);
  readonly exitoPassword = signal<string | null>(null);

  formPassword = {
    actual: '',
    nuevo: '',
    confirmar: '',
    codigo: ''
  };

  formPerfil = {
    nombres: '',
    apellidos: '',
    tipoDocumento: 'DNI',
    numeroDocumento: '',
    telefono: '',
    licenciaConducir: '',
    direccion: '',
    email: '',
    password: ''
  };

  ngOnInit(): void {
    this.vehiculoService.cargar();
    this.alquilerService.cargarMisAlquileres();
    this.pagoService.cargar();
    this.sincronizarFormulario(null);
    this.cargarPerfil();

    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'perfil') {
        this.router.navigate(['/cliente/perfil']);
      }
    });
  }

  readonly usuario = computed(() => this.authService.usuarioActual());

  readonly primerNombreVisual = computed(() => {
    // 1. Nombre real del usuario autenticado en sesión
    const u = this.usuario();
    if (u?.nombre && !u.nombre.includes('@') && u.nombre.toLowerCase() !== 'cliente') {
      const primer = u.nombre.trim().split(/\s+/)[0];
      if (primer) return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase();
    }

    // 2. Perfil cargado desde el backend para este cliente
    const p = this.perfilCliente();
    if (p && p.nombres && !p.nombres.includes('@') && p.nombres.toLowerCase() !== 'cliente') {
      const primer = p.nombres.trim().split(/\s+/)[0];
      if (primer) return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase();
    }

    // 3. Formulario del perfil si pertenece a la misma sesión
    const f = this.formPerfil;
    if (f && f.nombres && !f.nombres.includes('@') && f.email === u?.username) {
      const primer = f.nombres.trim().split(/\s+/)[0];
      if (primer) return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase();
    }

    // 4. Nombre a partir de username o correo del usuario
    const uname = u?.username || '';
    if (uname.includes('@')) {
      const base = uname.split('@')[0].replace(/[0-9_.-]/g, '');
      const primer = base.trim().split(/\s+/)[0];
      return primer ? (primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase()) : 'Cliente';
    }
    const partes = uname.trim().split(/\s+/);
    const primer = (partes[0] || '').replace(/[0-9_.-]/g, '');
    return primer ? (primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase()) : 'Cliente';
  });

  readonly nombreTitularVisual = computed(() => {
    const u = this.usuario();
    if (u?.nombre && !u.nombre.includes('@') && u.nombre.toLowerCase() !== 'cliente') {
      return u.nombre.trim();
    }
    const p = this.perfilCliente();
    if (p && p.nombres && !p.nombres.includes('@')) {
      const nom = p.nombres.trim();
      const ape = (p.apellidos && p.apellidos !== 'Cliente') ? p.apellidos.trim() : '';
      return `${nom} ${ape}`.trim();
    }
    const f = this.formPerfil;
    if (f && f.nombres && !f.nombres.includes('@') && f.email === u?.username) {
      const nom = f.nombres.trim();
      const ape = (f.apellidos && f.apellidos !== 'Cliente') ? f.apellidos.trim() : '';
      return `${nom} ${ape}`.trim();
    }
    const uname = u?.username || '';
    if (uname.includes('@')) {
      const base = uname.split('@')[0].replace(/[0-9_.-]/g, '');
      return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Cliente';
    }
    return uname || 'Cliente';
  });

  readonly vehiculosDisponibles = computed(
    () => this.vehiculoService.vehiculos().filter((v) => {
      const stock = v.unidadesDisponibles !== undefined
        ? v.unidadesDisponibles
        : (v.unidades ? v.unidades.filter((u) => (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE').length : 0);
      return v.activo !== false && stock > 0 && v.estado?.nombreEstado?.toUpperCase() === 'DISPONIBLE';
    }).length
  );

  readonly totalModelosActivos = computed(
    () => this.vehiculosDisponibles()
  );

  readonly misAlquileres = computed(() => this.alquilerService.misAlquileres());
  readonly reservasRecientes = computed(() =>
    this.misAlquileres()
      .filter((a) => {
        const est = (a.estado?.nombreEstado || '').toUpperCase();
        return est !== 'CANCELADO' && est !== 'RECHAZADO' && !est.includes('CANCEL') && !est.includes('RECHAZ');
      })
      .slice(0, 3)
  );

  readonly reservasActivas = computed(
    () => this.misAlquileres().filter((alquiler) => alquiler.estado?.nombreEstado === 'ACTIVO' || alquiler.estado?.nombreEstado === 'RESERVADO').length
  );

  readonly obtenerImagenVehiculo = obtenerImagenVehiculo;

  readonly flotaDisponible = computed(() => {
    const list = this.vehiculoService
      .vehiculos()
      .filter((v) => {
        const stock = v.unidadesDisponibles !== undefined
          ? v.unidadesDisponibles
          : (v.unidades ? v.unidades.filter((u) => (u.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE').length : 0);
        return v.activo !== false && stock > 0 && v.estado?.nombreEstado?.toUpperCase() === 'DISPONIBLE';
      });
    const porTipo = new Map<string, Vehiculo[]>();
    for (const v of list) {
      const t = (v.tipo?.nombreTipo || v.tipoCarroceria || 'AUTO').toUpperCase();
      if (!porTipo.has(t)) porTipo.set(t, []);
      porTipo.get(t)!.push(v);
    }
    const variados: Vehiculo[] = [];
    let idx = 0;
    while (variados.length < 4) {
      let agrego = false;
      for (const arr of porTipo.values()) {
        if (idx < arr.length && variados.length < 4) {
          variados.push(arr[idx]);
          agrego = true;
        }
      }
      if (!agrego) break;
      idx++;
    }
    return (variados.length > 0 ? variados : list).slice(0, 4);
  });

  readonly alquileresCompletados = computed(
    () => this.misAlquileres().filter((a) => a.estado?.nombreEstado === 'FINALIZADO').length
  );

  readonly totalPaginas = computed(() =>
    Math.ceil(this.misAlquileres().length / this.tamanoPagina()) || 1
  );

  readonly misAlquileresPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.misAlquileres().slice(inicio, inicio + this.tamanoPagina());
  });

  readonly paginasArray = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1)
  );

  readonly rangoInicio = computed(() => {
    if (this.misAlquileres().length === 0) return 0;
    return (this.paginaActual() - 1) * this.tamanoPagina() + 1;
  });

  readonly rangoFin = computed(() =>
    Math.min(this.paginaActual() * this.tamanoPagina(), this.misAlquileres().length)
  );

  readonly perfilCompleto = computed(() => {
    const p = this.perfilCliente();
    return !!(p && p.nombres && p.apellidos && p.numeroDocumento && !p.numeroDocumento.startsWith('PEND-') && p.licenciaConducir && p.telefono && p.direccion);
  });

  readonly perfilIncompleto = computed(() => {
    const p = this.perfilCliente();
    if (!p) return false;
    return !p.numeroDocumento || p.numeroDocumento.startsWith('PEND-') || !p.licenciaConducir || !p.direccion;
  });

  cambiarPestana(p: 'alquileres' | 'perfil'): void {
    this.pestanaActiva.set(p);
    this.mensajeExitoPerfil.set(null);
    this.mensajeErrorPerfil.set(null);
  }

  cargarPerfil(): void {
    this.cargandoPerfil.set(true);
    this.clienteService.obtenerMiPerfil().subscribe({
      next: (c) => {
        this.cargandoPerfil.set(false);
        this.perfilCliente.set(c);
        if (c?.passwordPersonalizado) {
          const user = this.usuario()?.username || 'cliente';
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('paulcars_password_cambiada_' + user, 'true');
          }
        }
        this.sincronizarFormulario(c);
      },
      error: () => {
        this.cargandoPerfil.set(false);
      }
    });
  }

  sincronizarFormulario(c: Cliente | null): void {
    const user = this.authService.usuarioActual();
    const username = user?.username || '';
    const storageKey = username ? `paulcars_perfil_cliente_${username}` : 'paulcars_perfil_cliente';
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    let localData: any = null;
    if (stored) {
      try { localData = JSON.parse(stored); } catch (e) {}
    }

    let defaultNombre = 'Cliente';
    if (user?.nombre && !user.nombre.includes('@') && user.nombre.toLowerCase() !== 'cliente') {
      defaultNombre = user.nombre.trim().split(/\s+/)[0] || user.nombre;
    } else if (user?.username?.includes('@')) {
      const base = user.username.split('@')[0].replace(/[0-9_.-]/g, '');
      if (base) {
        defaultNombre = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
      }
    } else if (user?.username) {
      defaultNombre = user.username;
    }

    let defaultApellido = '';
    if (user?.nombre && user.nombre.trim().split(/\s+/).length > 1) {
      defaultApellido = user.nombre.trim().split(/\s+/).slice(1).join(' ');
    }

    const nombres = (c?.nombres && !c.nombres.includes('@')) ? c.nombres.trim() : (c ? '' : (localData?.nombres || defaultNombre));
    const apellidos = (c?.apellidos && c.apellidos !== 'Cliente') ? c.apellidos.trim() : (c ? '' : (localData?.apellidos || defaultApellido));
    const tipoDocumento = c?.tipoDocumento || 'DNI';
    const numeroDocumento = (c?.numeroDocumento && c.numeroDocumento !== '00000000' && !c.numeroDocumento.startsWith('PEND-')) ? c.numeroDocumento.trim() : (c ? '' : (localData?.numeroDocumento || ''));
    const telefono = (c?.telefono && c.telefono !== '999999999' && c.telefono !== '000000000') ? c.telefono.trim() : (c ? '' : (localData?.telefono || ''));
    const licenciaConducir = c?.licenciaConducir ? c.licenciaConducir.trim() : (c ? '' : (localData?.licenciaConducir || ''));
    const direccion = c?.direccion ? c.direccion.trim() : (c ? '' : (localData?.direccion || ''));
    const email = (c?.email && c.email.includes('@')) ? c.email.trim() : (localData?.email || (user?.username?.includes('@') ? user.username : ''));

    this.formPerfil = {
      nombres,
      apellidos,
      tipoDocumento,
      numeroDocumento,
      telefono,
      licenciaConducir,
      direccion,
      email,
      password: ''
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('paulcars_perfil_cliente');
      if (username) {
        const { password: _, ...rest } = this.formPerfil;
        localStorage.setItem(storageKey, JSON.stringify(rest));
      }
    }
  }

  iniciarEdicion(): void {
    this.sincronizarFormulario(this.perfilCliente());
    this.mensajeExitoPerfil.set(null);
    this.mensajeErrorPerfil.set(null);
    this.editandoPerfil.set(true);
  }

  cancelarEdicion(): void {
    this.sincronizarFormulario(this.perfilCliente());
    this.formPerfil.password = '';
    this.mensajeErrorPerfil.set(null);
    this.editandoPerfil.set(false);
  }

  onDniPerfilInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 8);
    this.formPerfil.numeroDocumento = clean;
    input.value = clean;
  }

  onTelefonoPerfilInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 9);
    this.formPerfil.telefono = clean;
    input.value = clean;
  }

  onLicenciaPerfilInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
    this.formPerfil.licenciaConducir = val;
    input.value = val;
  }

  guardarPerfil(): void {
    this.mensajeExitoPerfil.set(null);
    this.mensajeErrorPerfil.set(null);

    const nombres = (this.formPerfil.nombres || '').trim();
    const apellidos = (this.formPerfil.apellidos || '').trim();
    const dni = (this.formPerfil.numeroDocumento || '').trim();
    const telefono = (this.formPerfil.telefono || '').trim();
    const licencia = (this.formPerfil.licenciaConducir || '').trim();
    const direccion = (this.formPerfil.direccion || '').trim();
    const password = (this.formPerfil.password || '').trim();

    if (!nombres || !apellidos) {
      this.mensajeErrorPerfil.set('Nombres y apellidos son requeridos.');
      return;
    }
    if (dni && !/^\d{8}$/.test(dni)) {
      this.mensajeErrorPerfil.set('El DNI debe tener exactamente 8 dígitos numéricos.');
      return;
    }
    if (telefono && !/^9\d{8}$/.test(telefono)) {
      this.mensajeErrorPerfil.set('El número de celular debe comenzar con 9 y tener 9 dígitos.');
      return;
    }
    if (licencia && !/^[A-Za-z]\d{8}$/.test(licencia)) {
      this.mensajeErrorPerfil.set('La licencia debe tener el formato estándar (ej: Q12345678).');
      return;
    }
    if (password && password.length < 4) {
      this.mensajeErrorPerfil.set('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    const payload: Partial<Cliente> = {
      nombres,
      apellidos,
      tipoDocumento: this.formPerfil.tipoDocumento || 'DNI',
      numeroDocumento: dni,
      telefono,
      licenciaConducir: licencia,
      direccion
    };
    if (password) {
      payload.password = password;
    }

    this.guardandoPerfil.set(true);
    this.clienteService.actualizarMiPerfil(payload).subscribe({
      next: (actualizado) => {
        this.guardandoPerfil.set(false);
        this.perfilCliente.set(actualizado);
        this.sincronizarFormulario(actualizado);
        this.formPerfil.password = '';
        this.editandoPerfil.set(false);
        this.mensajeExitoPerfil.set('¡Datos de tu perfil actualizados con éxito!');
      },
      error: () => {
        this.guardandoPerfil.set(false);
        if (typeof localStorage !== 'undefined') {
          const user = this.authService.usuarioActual();
          const storageKey = user?.username ? `paulcars_perfil_cliente_${user.username}` : 'paulcars_perfil_cliente';
          const { password: _, ...rest } = this.formPerfil;
          localStorage.setItem(storageKey, JSON.stringify(rest));
          localStorage.removeItem('paulcars_perfil_cliente');
        }
        this.formPerfil.password = '';
        this.editandoPerfil.set(false);
        this.mensajeExitoPerfil.set('¡Datos de tu perfil actualizados con éxito!');
      }
    });
  }

  abrirModalCambiarPassword(): void {
    this.formPassword = { actual: '', nuevo: '', confirmar: '', codigo: '' };
    this.errorPassword.set(null);
    this.exitoPassword.set(null);
    this.modalPasswordAbierto.set(true);
  }

  cerrarModalCambiarPassword(): void {
    this.modalPasswordAbierto.set(false);
  }

  ejecutarCambioPassword(): void {
    this.errorPassword.set(null);
    this.exitoPassword.set(null);

    const actual = (this.formPassword.actual || '').trim();
    const nuevo = (this.formPassword.nuevo || '').trim();
    const confirmar = (this.formPassword.confirmar || '').trim();

    if (!actual) {
      this.errorPassword.set('Debes ingresar tu contraseña actual.');
      return;
    }
    if (!nuevo || nuevo.length < 4) {
      this.errorPassword.set('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (nuevo !== confirmar) {
      this.errorPassword.set('Las contraseñas no coinciden. Verifica e intenta nuevamente.');
      return;
    }

    this.guardandoPassword.set(true);
    this.clienteService.cambiarPassword({
      passwordActual: actual,
      passwordNuevo: nuevo
    }).subscribe({
      next: () => {
        this.guardandoPassword.set(false);
        this.exitoPassword.set('¡Tu contraseña fue actualizada con éxito!');
        this.marcarPasswordPersonalizada();
        setTimeout(() => this.cerrarModalCambiarPassword(), 1800);
      },
      error: (err) => {
        this.guardandoPassword.set(false);
        this.errorPassword.set(err?.error?.message || 'La contraseña actual ingresada es incorrecta.');
      }
    });
  }

  marcarPasswordPersonalizada(): void {
    const user = this.usuario()?.username || 'cliente';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('paulcars_password_cambiada_' + user, 'true');
    }
    const actual = this.perfilCliente();
    if (actual) {
      this.perfilCliente.set({ ...actual, passwordPersonalizado: true });
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

  irAPagina(p: number): void {
    this.paginaActual.set(p);
  }

  formatearSede(sede?: string): string {
    const s = (sede || '').toUpperCase();
    if (s === 'AEROPUERTO') return 'Aeropuerto Internacional Jorge Chávez';
    return 'Sede Miraflores';
  }

  calcularGarantiaPorTipo(tipo?: string): number {
    const t = (tipo || '').toUpperCase();
    if (t.includes('PICKUP') || t.includes('CAMIONETA')) return 7000;
    if (t.includes('SUV')) return 5000;
    if (t.includes('SEDAN') || t.includes('SEDÁN')) return 3500;
    if (t.includes('HATCHBACK')) return 2500;
    return 3500;
  }

  calcularDias(inicioStr?: string, finStr?: string): number {
    if (!inicioStr || !finStr) return 1;
    const ini = new Date(inicioStr).getTime();
    const fin = new Date(finStr).getTime();
    const diff = Math.round((fin - ini) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }

  obtenerGarantiaAlquiler(alquiler: Alquiler): number {
    return this.calcularGarantiaPorTipo(alquiler.vehiculo?.tipo?.nombreTipo);
  }

  obtenerLiquidacion(alquiler: Alquiler): LiquidacionAlquiler {
    return obtenerLiquidacionAlquiler(alquiler);
  }

  nombreVehiculo(alq?: Alquiler | null): string {
    if (!alq?.vehiculo?.modelo) return 'Vehículo';
    const marca = alq.vehiculo.modelo.marca?.nombreMarca || '';
    const mod = alq.vehiculo.modelo.modelo || '';
    return `${marca} ${mod}`.trim() || 'Vehículo';
  }

  placaVehiculo(alq?: Alquiler | null): string {
    return alq?.vehiculo?.placa || 'Por asignar';
  }

  imagenVehiculo(alq?: Alquiler | null): string {
    return obtenerImagenVehiculo(alq?.vehiculo) || 'images/default-car.png';
  }

  abrirDetalleLiquidacion(alquiler: Alquiler): void {
    this.dialog.open(ActaLiquidacionDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      panelClass: 'modal-comprobante-dialog',
      data: {
        alquiler,
        pagado: this.esReservaPagada(alquiler)
      }
    });
  }

  cerrarDetalleLiquidacion(): void {
    this.alquilerSeleccionado.set(null);
  }

  esReservaPagada(alq: Alquiler): boolean {
    const e = (alq.estado?.nombreEstado || '').toUpperCase();
    if (e === 'PAGADO' || e === 'CONFIRMADO') return true;
    if (alq.idAlquiler) {
      return this.pagoService.pagos().some(
        (p) => p.alquiler?.idAlquiler === alq.idAlquiler && p.tipoPago !== 'LIQUIDACION'
      );
    }
    return false;
  }

  claseEstadoAlquiler(estado?: string): string {
    const e = (estado || '').toUpperCase();
    if (e === 'PENDIENTE') return 'status-badge-pendiente';
    if (e === 'RESERVADO' || e === 'APROBADO' || e === 'PAGADO' || e === 'CONFIRMADO') return 'status-badge-reservado';
    if (e === 'ACTIVO' || e === 'EN_CURSO' || e === 'EN CURSO') return 'status-badge-activo';
    if (e === 'FINALIZADO') return 'status-badge-finalizado';
    return 'status-badge-cancelado';
  }

  imprimirLiquidacion(liq: LiquidacionAlquiler, alquiler: Alquiler): void {
    const estado = (alquiler.estado?.nombreEstado || '').toUpperCase();
    const tituloDoc = estado === 'FINALIZADO'
      ? 'COMPROBANTE OFICIAL DE LIQUIDACIÓN DE ALQUILER'
      : estado === 'RESERVADO'
      ? 'COMPROBANTE DE RESERVA APROBADA'
      : estado === 'ACTIVO'
      ? 'COMPROBANTE DE ALQUILER EN CURSO'
      : estado === 'PENDIENTE'
      ? 'COMPROBANTE DE SOLICITUD DE RESERVA'
      : 'COMPROBANTE DE SOLICITUD';

    const subtituloDoc = estado === 'FINALIZADO'
      ? 'Inspección final conforme & Garantía devuelta'
      : estado === 'RESERVADO'
      ? 'Reserva confirmada & Garantía a presentar en counter'
      : estado === 'ACTIVO'
      ? 'Contrato en curso & Garantía retenida en counter'
      : estado === 'PENDIENTE'
      ? 'Solicitud registrada en espera de confirmación'
      : 'Registro de solicitud anulada sin penalidad';

    const marca = alquiler.vehiculo?.modelo?.marca?.nombreMarca || '';
    const modelo = alquiler.vehiculo?.modelo?.modelo || '';
    const placa = alquiler.vehiculo?.placa || 'En asignación';
    const clienteNom = alquiler.cliente ? `${alquiler.cliente.nombres} ${alquiler.cliente.apellidos}` : 'Cliente';
    const clienteDoc = alquiler.cliente?.numeroDocumento || '—';
    const clienteTel = alquiler.cliente?.telefono || '—';
    const clienteEmail = alquiler.cliente?.email || '—';

    const w = window.open('', '_blank', 'width=880,height=960');
    if (!w) return;

    w.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Paul Car's - ${tituloDoc} ${this.formatearCodigoAlquiler(alquiler.idAlquiler)}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 13px; line-height: 1.45; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d1b3e; padding-bottom: 16px; margin-bottom: 20px; }
          .brand h1 { margin: 0; font-size: 22px; color: #0d1b3e; text-transform: uppercase; letter-spacing: 0.5px; }
          .brand p { margin: 2px 0 0; color: #64748b; font-size: 11px; }
          .doc-badge { text-align: right; }
          .doc-badge .tag { background: #0d1b3e; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; }
          .doc-badge .num { font-size: 18px; font-weight: 800; color: #0d1b3e; margin-top: 4px; }
          .doc-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
          .section { margin-bottom: 18px; }
          .section-title { font-size: 12px; font-weight: 800; color: #0d1b3e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
          .info-box p { margin: 3px 0; font-size: 12px; }
          .info-box strong { color: #334155; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
          th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px 10px; font-weight: 700; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
          .total-box { background: #f8fafc; border: 2px solid #0d1b3e; border-radius: 6px; padding: 12px; margin-top: 14px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
          .total-row.final { font-size: 16px; font-weight: 800; color: #0d1b3e; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 6px; }
          .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 10px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
          .sig-line { border-top: 1px solid #94a3b8; text-align: center; padding-top: 6px; font-size: 11px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <h1>PAUL CAR'S ALQUILER DE VEHÍCULOS</h1>
            <p>RUC: 20601234567 &bull; Lima, Perú &bull; Tel: (01) 445-8890</p>
          </div>
          <div class="doc-badge">
            <div class="tag">${tituloDoc}</div>
            <div class="num">N° ALQ-${String(alquiler.idAlquiler).padStart(6, '0')}</div>
            <div class="doc-sub">${subtituloDoc}</div>
          </div>
        </div>

        <div class="section">
          <div class="grid-2">
            <div class="info-box">
              <div class="section-title">Datos del Cliente</div>
              <p><strong>Titular:</strong> ${clienteNom}</p>
              <p><strong>Documento (DNI):</strong> ${clienteDoc}</p>
              <p><strong>Teléfono:</strong> ${clienteTel}</p>
              <p><strong>Correo:</strong> ${clienteEmail}</p>
            </div>
            <div class="info-box">
              <div class="section-title">Vehículo Asignado</div>
              <p><strong>Modelo:</strong> ${marca} ${modelo}</p>
              <p><strong>Placa:</strong> ${placa}</p>
              <p><strong>Categoría:</strong> ${liq.tipoVehiculo}</p>
              <p><strong>Tarifa Diaria:</strong> S/ ${liq.tarifaDia.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="info-box">
            <div class="section-title">Detalles del Servicio</div>
            <div class="grid-2">
              <div>
                <p><strong>Sede de Recojo:</strong> ${liq.sedeRecojo}</p>
                <p><strong>Fecha y Hora de Inicio:</strong> ${alquiler.fechaInicio} &bull; ${liq.horaEntregaPactada}</p>
              </div>
              <div>
                <p><strong>Sede de Devolución:</strong> ${liq.sedeDevolucion}</p>
                <p><strong>Fecha y Hora de Devolución:</strong> ${alquiler.fechaFinEstimada} &bull; ${liq.horaDevolucionProgramada}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Desglose de Liquidación</div>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th style="text-align: center;">Cantidad</th>
                <th style="text-align: right;">Unitario</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Alquiler Base de Vehículo (${marca} ${modelo})</td>
                <td style="text-align: center;">${liq.dias} días</td>
                <td style="text-align: right;">S/ ${liq.tarifaDia.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.subtotalAlquiler.toFixed(2)}</td>
              </tr>
              ${liq.montoExtras > 0 ? `
              <tr>
                <td>Servicios Extras (${liq.extrasTexto})</td>
                <td style="text-align: center;">1</td>
                <td style="text-align: right;">S/ ${liq.montoExtras.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.montoExtras.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${liq.montoRetraso > 0 ? `
              <tr>
                <td>Cargo por Retraso en Devolución (${liq.retrasoHoras} hrs)</td>
                <td style="text-align: center;">${liq.retrasoHoras} hrs</td>
                <td style="text-align: right;">S/ ${liq.tarifaHoraRetraso.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.montoRetraso.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${liq.montoPercance > 0 ? `
              <tr>
                <td>Penalidades / Percances Observados</td>
                <td style="text-align: center;">1</td>
                <td style="text-align: right;">S/ ${liq.montoPercance.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${liq.montoPercance.toFixed(2)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-row">
              <span>Depósito de Garantía Retenido en Counter:</span>
              <strong>S/ ${liq.depositoGarantia.toFixed(2)}</strong>
            </div>
            <div class="total-row">
              <span>Estado de la Garantía:</span>
              <strong>${liq.estadoGarantia === 'LIBERADA_TOTAL' ? 'LIBERADA 100% (Sin multas ni daños)' : liq.estadoGarantia === 'RETENIDA_PARCIAL' ? 'RETENCIÓN PARCIAL' : 'EN CUSTODIA (Se reembolsa al devolver)'}</strong>
            </div>
            <div class="total-row final">
              <span>TOTAL FACTURADO DEL ALQUILER:</span>
              <span>S/ ${liq.totalAlquiler.toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${(estado === 'ACTIVO' || estado === 'FINALIZADO') ? `
        <div class="signatures">
          <div class="sig-line">
            Firma del Asesor de Counter<br>
            <strong>Paul Car's Alquiler de Vehículos</strong>
          </div>
          <div class="sig-line">
            Firma y DNI del Conductor Autorizado<br>
            <strong>${clienteNom} &bull; DNI ${clienteDoc}</strong>
          </div>
        </div>
        ` : `
        <div style="margin-top: 24px; padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b; font-size: 11px;">
          Comprobante digital informativo de solicitud de reserva. La entrega de la unidad física y firma de contrato se realizan en counter Paul Car's previa presentación de DNI y licencia vigentes.
        </div>
        `}

        <div class="footer">
          Documento generado electrónicamente en el Sistema Paul Car's &bull; Fecha: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    w.document.close();
  }
}
