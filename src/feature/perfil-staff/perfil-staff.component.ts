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

  // Nombre que se muestra: primer nombre y primer apellido, tal como están registrados
  readonly nombreHeroVisual = computed(() => {
    this.perfilActualizado();
    const n = (this.formPerfil.nombres || '').trim().split(/\s+/)[0] || '';
    const a = (this.formPerfil.apellidos || '').trim().split(/\s+/)[0] || '';
    return `${n} ${a}`.trim() || this.usuario()?.nombre || 'Usuario';
  });

  readonly nombreCompletoVisual = computed(() => this.nombreHeroVisual());

  ngOnInit(): void {
    this.cargarDatosPerfil();
  }

  // Los datos salen del propio usuario registrado en el sistema
  cargarDatosPerfil(): void {
    const user = this.usuario();
    const username = user?.username || '';
    this.formPerfil = {
      nombres: '',
      apellidos: '',
      numeroDocumento: '',
      telefono: '',
      email: user?.email || username,
      rol: this.etiquetaRol()
    };
    this.perfilActualizado.update((v) => v + 1);

    this.authService.obtenerPerfilPersonal().subscribe({
      next: (p) => {
        this.formPerfil = {
          nombres: p.nombres || '',
          apellidos: p.apellidos || '',
          numeroDocumento: p.dni || '',
          telefono: '',
          email: p.email || username,
          rol: this.etiquetaRol()
        };
        this.perfilActualizado.update((v) => v + 1);
      },
      error: () => undefined
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

  guardarPerfil(): void {
    this.mensajeExitoPerfil.set(null);
    this.mensajeErrorPerfil.set(null);

    const nombres = (this.formPerfil.nombres || '').trim();
    const apellidos = (this.formPerfil.apellidos || '').trim();
    const dni = (this.formPerfil.numeroDocumento || '').trim();

    if (!nombres) {
      this.mensajeErrorPerfil.set('Ingresa tus nombres.');
      return;
    }
    if (!apellidos) {
      this.mensajeErrorPerfil.set('Ingresa tus apellidos.');
      return;
    }
    if (dni.length !== 8) {
      this.mensajeErrorPerfil.set('El DNI debe contener exactamente 8 dígitos numéricos.');
      return;
    }

    this.guardandoPerfil.set(true);
    this.authService.actualizarPerfilPersonal({ nombres, apellidos, dni }).subscribe({
      next: () => {
        this.guardandoPerfil.set(false);
        this.editandoPerfil.set(false);
        this.perfilActualizado.update((v) => v + 1);
        this.mensajeExitoPerfil.set('Datos actualizados.');
        this.authService.refrescarPerfil();
      },
      error: (err) => {
        this.guardandoPerfil.set(false);
        this.mensajeErrorPerfil.set(err?.error?.message || 'No se pudieron guardar los datos.');
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
