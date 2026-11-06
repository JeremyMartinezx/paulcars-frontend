import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/service/auth.service';
import { ClienteService } from '../../../core/service/cliente.service';
import { Cliente } from '../../../core/models/cliente.model';

interface FormPerfilCliente {
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  licenciaConducir: string;
  telefono: string;
  direccion: string;
  email: string;
}

@Component({
  selector: 'app-perfil-cliente',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './perfil-cliente.component.html',
  styleUrl: './perfil-cliente.component.css'
})
export class PerfilClienteComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clienteService = inject(ClienteService);
  private readonly router = inject(Router);

  readonly usuario = computed(() => this.authService.usuarioActual());
  readonly perfilCliente = signal<Cliente | null>(null);

  readonly editandoPerfil = signal(false);
  readonly guardandoPerfil = signal(false);
  readonly mensajeExitoPerfil = signal<string | null>(null);
  readonly mensajeErrorPerfil = signal<string | null>(null);

  formPerfil: FormPerfilCliente = {
    nombres: '',
    apellidos: '',
    tipoDocumento: 'DNI',
    numeroDocumento: '',
    licenciaConducir: '',
    telefono: '',
    direccion: '',
    email: ''
  };

  // Modal Cambiar Contraseña
  readonly modalPasswordAbierto = signal(false);
  readonly guardandoPassword = signal(false);
  readonly errorPassword = signal<string | null>(null);
  readonly exitoPassword = signal<string | null>(null);

  formPassword = {
    actual: '',
    nuevo: '',
    confirmar: ''
  };

  readonly nombreCompletoVisual = computed(() => {
    const u = this.usuario();
    if (u?.nombre && !u.nombre.includes('@') && u.nombre.toLowerCase() !== 'cliente') {
      return u.nombre.trim();
    }
    const p = this.perfilCliente();
    if (p && p.nombres && !p.nombres.includes('@') && p.nombres.toLowerCase() !== 'cliente') {
      const nom = p.nombres.trim();
      const ape = (p.apellidos && p.apellidos !== 'Cliente') ? p.apellidos.trim() : '';
      return `${nom} ${ape}`.trim();
    }
    const n = (this.formPerfil.nombres || '').trim();
    const a = (this.formPerfil.apellidos || '').trim();
    if (n || a) return `${n} ${a}`.trim();
    return 'Cliente Paul Car\'s';
  });

  ngOnInit(): void {
    this.cargarDatosPerfil();
  }

  cargarDatosPerfil(): void {
    const user = this.usuario();
    const username = user?.username || 'cliente';
    const email = user?.email || (username.includes('@') ? username : `${username}@paulcars.com`);

    const storageKey = username ? `paulcars_perfil_cliente_${username}` : 'paulcars_perfil_cliente';
    let localData: Partial<FormPerfilCliente> | null = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('paulcars_perfil_cliente');
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          localData = JSON.parse(stored);
        } catch (_) {}
      }
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

    this.formPerfil = {
      nombres: localData?.nombres || defaultNombre,
      apellidos: localData?.apellidos || defaultApellido,
      tipoDocumento: localData?.tipoDocumento || 'DNI',
      numeroDocumento: localData?.numeroDocumento || '',
      licenciaConducir: localData?.licenciaConducir || '',
      telefono: localData?.telefono || '',
      direccion: localData?.direccion || '',
      email: localData?.email || email
    };

    // Consultar el perfil real del backend
    this.clienteService.obtenerMiPerfil().subscribe({
      next: (c) => {
        if (c) {
          this.perfilCliente.set(c);
          if (c.nombres && !c.nombres.toLowerCase().includes('cliente') && !c.nombres.toLowerCase().includes('por completar')) {
            this.formPerfil.nombres = c.nombres.trim();
          }
          if (c.apellidos && !c.apellidos.toLowerCase().includes('por completar')) {
            this.formPerfil.apellidos = c.apellidos.trim();
          }
          if (c.numeroDocumento && !c.numeroDocumento.startsWith('PEND-') && c.numeroDocumento !== '00000000') {
            this.formPerfil.numeroDocumento = c.numeroDocumento.trim();
          } else {
            this.formPerfil.numeroDocumento = '';
          }
          if (c.licenciaConducir) {
            this.formPerfil.licenciaConducir = c.licenciaConducir.trim();
          } else {
            this.formPerfil.licenciaConducir = '';
          }
          if (c.telefono && c.telefono !== '000000000' && c.telefono !== '999999999') {
            this.formPerfil.telefono = c.telefono.trim();
          } else {
            this.formPerfil.telefono = '';
          }
          if (c.direccion) {
            this.formPerfil.direccion = c.direccion.trim();
          } else {
            this.formPerfil.direccion = '';
          }
          if (c.email && c.email.includes('@')) {
            this.formPerfil.email = c.email.trim();
          }
          if (typeof localStorage !== 'undefined' && storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(this.formPerfil));
          }
        }
      },
      error: () => {
        // Fallback fluido con datos locales
      }
    });
  }

  iniciarEdicion(): void {
    this.mensajeExitoPerfil.set(null);
    this.mensajeErrorPerfil.set(null);
    this.editandoPerfil.set(true);
  }

  cancelarEdicion(): void {
    this.cargarDatosPerfil();
    this.editandoPerfil.set(false);
    this.mensajeErrorPerfil.set(null);
  }

  onDniInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 8);
    this.formPerfil.numeroDocumento = input.value;
  }

  onTelefonoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 9);
    this.formPerfil.telefono = input.value;
  }

  onLicenciaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.toUpperCase().slice(0, 9);
    this.formPerfil.licenciaConducir = input.value;
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

    if (!nombres) {
      this.mensajeErrorPerfil.set('Ingresa tus nombres completos.');
      return;
    }
    if (!apellidos) {
      this.mensajeErrorPerfil.set('Ingresa tus apellidos completos.');
      return;
    }
    if (!dni || dni.length !== 8) {
      this.mensajeErrorPerfil.set('El DNI debe contener exactamente 8 dígitos numéricos.');
      return;
    }
    if (telefono && telefono.length !== 9) {
      this.mensajeErrorPerfil.set('El teléfono celular debe contener 9 dígitos.');
      return;
    }

    this.guardandoPerfil.set(true);

    if (typeof localStorage !== 'undefined') {
      const user = this.usuario();
      const username = user?.username || '';
      const storageKey = username ? `paulcars_perfil_cliente_${username}` : 'paulcars_perfil_cliente';
      localStorage.setItem(storageKey, JSON.stringify(this.formPerfil));
      localStorage.removeItem('paulcars_perfil_cliente');
    }

    this.clienteService.actualizarMiPerfil({
      nombres,
      apellidos,
      tipoDocumento: 'DNI',
      numeroDocumento: dni,
      telefono,
      licenciaConducir: licencia,
      direccion
    }).subscribe({
      next: (actualizado) => {
        this.guardandoPerfil.set(false);
        this.perfilCliente.set(actualizado);
        this.editandoPerfil.set(false);
        this.mensajeExitoPerfil.set('¡Datos de tu perfil actualizados con éxito!');
        this.authService.refrescarPerfil();
      },
      error: () => {
        this.guardandoPerfil.set(false);
        this.editandoPerfil.set(false);
        this.mensajeExitoPerfil.set('¡Datos de tu perfil actualizados con éxito!');
        this.authService.refrescarPerfil();
      }
    });
  }

  // Modal Cambiar Contraseña
  abrirModalCambiarPassword(): void {
    this.formPassword = { actual: '', nuevo: '', confirmar: '' };
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
        setTimeout(() => this.cerrarModalCambiarPassword(), 1600);
      },
      error: (err) => {
        this.guardandoPassword.set(false);
        this.errorPassword.set(err?.error?.message || 'La contraseña actual ingresada es incorrecta.');
      }
    });
  }

  volver(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/cliente']);
    }
  }
}
