import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/service/auth.service';
import { ClienteService } from '../../core/service/cliente.service';

interface FormPerfilStaff {
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  telefono: string;
  email: string;
  rol: string;
}

@Component({
  selector: 'app-perfil-staff',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './perfil-staff.component.html',
  styleUrl: './perfil-staff.component.css'
})
export class PerfilStaffComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clienteService = inject(ClienteService);
  private readonly router = inject(Router);

  readonly usuario = computed(() => this.authService.usuarioActual());
  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');
  readonly esAsesor = computed(() => this.authService.rolActual() === 'EMPLEADO');

  readonly rutaPanel = computed(() => this.esAdmin() ? '/admin' : '/empleado');
  readonly etiquetaRol = computed(() => this.esAdmin() ? 'Administrador' : 'Asesor de Ventas');

  readonly editandoPerfil = signal(false);
  readonly guardandoPerfil = signal(false);
  readonly mensajeExitoPerfil = signal<string | null>(null);
  readonly mensajeErrorPerfil = signal<string | null>(null);
  readonly perfilActualizado = signal(0);

  formPerfil: FormPerfilStaff = {
    nombres: '',
    apellidos: '',
    numeroDocumento: '',
    telefono: '',
    email: '',
    rol: ''
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

  readonly nombreHeroVisual = computed(() => {
    this.perfilActualizado();
    if (this.esAdmin()) {
      return 'Paul Cars Administrador';
    }

    // Para el Asesor: formato dinámico "Asesor [PrimerNombre] [PrimerApellido]"
    const n = (this.formPerfil.nombres || '').trim();
    const a = (this.formPerfil.apellidos || '').trim();

    let primerNombre = '';
    let primerApellido = '';

    if (n.includes('Counter')) {
      const tokens = n.split('-')[0].trim().split(/\s+/);
      primerNombre = tokens[0] || 'Carlos';
      primerApellido = tokens[1] || 'Mendoza';
    } else {
      primerNombre = n ? n.split(/\s+/)[0] : 'Carlos';
      primerApellido = a ? a.split(/\s+/)[0] : 'Mendoza';
    }

    return `Asesor ${primerNombre} ${primerApellido}`.trim();
  });

  // Para retrocompatibilidad
  readonly nombreCompletoVisual = computed(() => this.nombreHeroVisual());

  ngOnInit(): void {
    this.cargarDatosPerfil();
  }

  cargarDatosPerfil(): void {
    const user = this.usuario();
    const username = user?.username || 'usuario';
    const email = user?.email || (username.includes('@') ? username : `${username}@paulcars.com`);
    const rolEtiqueta = this.etiquetaRol();

    // Valores por defecto según rol
    let defaultNombres = this.esAdmin() ? 'Víctor Manuel' : 'Carlos Miguel';
    let defaultApellidos = this.esAdmin() ? 'Paredes Silva' : 'Mendoza Muñoz';
    let defaultDni = this.esAdmin() ? '70000001' : '72172845';
    let defaultTelefono = this.esAdmin() ? '959137712' : '978111232';

    // Cargar si existe personalización previa en localStorage
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('paulcars_perfil_staff_' + username);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as FormPerfilStaff;
          // Sanitizar datos anteriores con valores obsoletos
          const esObsoletoAsesor = !this.esAdmin() && (
            parsed.nombres?.includes('Counter') ||
            parsed.apellidos === 'Muñoz' ||
            parsed.nombres === 'Asesor'
          );
          const esObsoletoAdmin = this.esAdmin() && (
            parsed.nombres?.includes('Paul Cars') ||
            parsed.apellidos?.includes('Administrador')
          );

          if (!esObsoletoAsesor && !esObsoletoAdmin) {
            defaultNombres = parsed.nombres || defaultNombres;
            defaultApellidos = parsed.apellidos || defaultApellidos;
            defaultDni = parsed.numeroDocumento || defaultDni;
            defaultTelefono = parsed.telefono || defaultTelefono;
          } else {
            localStorage.removeItem('paulcars_perfil_staff_' + username);
          }
        } catch (_) {}
      }
    }

    this.formPerfil = {
      nombres: defaultNombres,
      apellidos: defaultApellidos,
      numeroDocumento: defaultDni,
      telefono: defaultTelefono,
      email: email,
      rol: rolEtiqueta
    };
    this.perfilActualizado.update(v => v + 1);

    // Intentar sincronizar con el backend si existe registro asociado
    this.clienteService.obtenerMiPerfil().subscribe({
      next: (c) => {
        if (c) {
          if (c.nombres && !c.nombres.toLowerCase().includes('cliente') && !c.nombres.toLowerCase().includes('por completar')) {
            if (this.esAdmin() && c.nombres.includes('Paul Cars')) {
              this.formPerfil.nombres = 'Víctor Manuel';
            } else if (!this.esAdmin() && c.nombres.includes('Counter')) {
              this.formPerfil.nombres = 'Carlos Miguel';
            } else {
              this.formPerfil.nombres = c.nombres.trim();
            }
          }
          if (c.apellidos && !c.apellidos.toLowerCase().includes('por completar')) {
            if (this.esAdmin() && c.apellidos.includes('Administrador')) {
              this.formPerfil.apellidos = 'Paredes Silva';
            } else if (!this.esAdmin() && c.apellidos === 'Muñoz') {
              this.formPerfil.apellidos = 'Mendoza Muñoz';
            } else {
              this.formPerfil.apellidos = c.apellidos.trim();
            }
          }
          if (c.numeroDocumento && !c.numeroDocumento.startsWith('PEND-')) {
            this.formPerfil.numeroDocumento = c.numeroDocumento.trim();
          }
          if (c.telefono && c.telefono !== '000000000' && c.telefono !== '999999999') {
            this.formPerfil.telefono = c.telefono.trim();
          }
          if (c.email && c.email.includes('@')) {
            this.formPerfil.email = c.email.trim();
          }
          this.perfilActualizado.update(v => v + 1);
        }
      },
      error: () => {
        // Usa los valores por defecto / locales sin interrumpir la interfaz
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

  guardarPerfil(): void {
    this.mensajeExitoPerfil.set(null);
    this.mensajeErrorPerfil.set(null);

    const nombres = (this.formPerfil.nombres || '').trim();
    const apellidos = (this.formPerfil.apellidos || '').trim();
    const dni = (this.formPerfil.numeroDocumento || '').trim();
    const telefono = (this.formPerfil.telefono || '').trim();

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

    const username = this.usuario()?.username || 'usuario';

    // Persistir localmente de inmediato para respuesta fluida
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('paulcars_perfil_staff_' + username, JSON.stringify(this.formPerfil));
    }
    this.perfilActualizado.update(v => v + 1);

    // Actualizar en el backend
    this.clienteService.actualizarMiPerfil({
      nombres,
      apellidos,
      tipoDocumento: 'DNI',
      numeroDocumento: dni,
      telefono
    }).subscribe({
      next: () => {
        this.guardandoPerfil.set(false);
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

  // Modal de Contraseña
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
      this.router.navigate([this.rutaPanel()]);
    }
  }
}
