import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/service/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ocultarPassword = true;
  cargando = false;
  error = '';

  modalRecuperarAbierto = false;
  pasoRecuperar: 1 | 2 | 3 = 1;
  recuperarEmail = '';
  recuperarCodigo = '';
  recuperarPasswordNuevo = '';
  recuperarPasswordConfirmar = '';
  recuperarCargando = false;
  recuperarError: string | null = null;
  recuperarExito: string | null = null;
  recuperarAviso: string | null = null;
  ocultarNuevoPassword = true;
  ocultarConfirmarPassword = true;

  loginForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    const qEmail = this.route.snapshot.queryParamMap.get('email');
    if (qEmail) {
      this.loginForm.patchValue({ username: qEmail });
    }
  }

  iniciarSesion(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.error = '';

    const raw = this.loginForm.getRawValue();
    const credenciales = {
      username: (raw.username || '').trim(),
      password: (raw.password || '').trim()
    };

    if (/^\d+$/.test(credenciales.username)) {
      this.error = 'No está permitido iniciar sesión con DNI. Ingresa con tu correo electrónico.';
      this.cargando = false;
      return;
    }

    this.authService.login(credenciales).subscribe({
      next: (response) => {
        const destino = response.rol === 'ADMIN' ? '/admin' : response.rol === 'EMPLEADO' ? '/empleado' : '/cliente';

    this.router.navigate([destino]).then((exito) => {
      this.cargando = false;

      if (!exito) {
        console.error('La navegación a', destino, 'no se completó. Revisa la consola arriba por errores.');
        this.error = 'No se pudo abrir el panel. Revisa la consola del navegador (F12).';
      }
    }).catch((err) => {
      this.cargando = false;
      console.error('Error de navegación:', err);
      this.error = 'Ocurrió un error al abrir el panel.';
    });
  },
      error: (err) => {
        if (err?.error?.message) {
          this.error = err.error.message;
        } else {
          this.error = 'Usuario o contraseña incorrectos.';
        }
        this.cargando = false;
      }
    });
  }

  abrirModalRecuperar(): void {
    this.modalRecuperarAbierto = true;
    this.pasoRecuperar = 1;
    this.recuperarError = null;
    this.recuperarExito = null;
    this.recuperarAviso = null;
    this.recuperarEmail = (this.loginForm.controls.username.value || '').trim();
    this.recuperarCodigo = '';
    this.recuperarPasswordNuevo = '';
    this.recuperarPasswordConfirmar = '';
  }

  cerrarModalRecuperar(): void {
    this.modalRecuperarAbierto = false;
  }

  enviarCodigoRecuperacion(): void {
    this.recuperarError = null;
    this.recuperarExito = null;
    this.recuperarAviso = null;
    const email = (this.recuperarEmail || '').trim();
    if (!email || !email.includes('@')) {
      this.recuperarError = 'Ingresa un correo electrónico válido.';
      return;
    }

    this.recuperarCargando = true;
    this.authService.solicitarCodigoRecuperacion(email).subscribe({
      next: (res: any) => {
        this.recuperarCargando = false;
        this.pasoRecuperar = 2;
        this.recuperarCodigo = '';
        if (res?.correoEnviado) {
          this.recuperarExito = '¡Código de verificación enviado exitosamente a tu correo! Revisa tu bandeja de entrada o spam.';
          this.recuperarAviso = null;
        } else {
          this.recuperarExito = null;
          // Por seguridad el código nunca viaja en la respuesta; solo llega por correo
          this.recuperarAviso = res?.mensaje || 'No se pudo enviar el correo. Intenta más tarde o acércate a counter.';
        }
      },
      error: (err) => {
        this.recuperarCargando = false;
        this.recuperarError = err?.error?.message || 'No existe una cuenta registrada con este correo electrónico.';
      }
    });
  }

  verificarCodigoRecuperacion(): void {
    this.recuperarError = null;
    this.recuperarExito = null;
    const email = (this.recuperarEmail || '').trim();
    const codigo = (this.recuperarCodigo || '').trim();

    if (!codigo || codigo.length !== 6) {
      this.recuperarError = 'Ingresa el código de 6 dígitos que enviamos a tu correo.';
      return;
    }

    this.recuperarCargando = true;
    this.authService.validarCodigoRecuperacion(email, codigo).subscribe({
      next: () => {
        this.recuperarCargando = false;
        this.pasoRecuperar = 3;
        this.recuperarExito = null;
        this.recuperarError = null;
      },
      error: (err) => {
        this.recuperarCargando = false;
        this.recuperarError = err?.error?.message || 'Código de verificación incorrecto o expirado.';
      }
    });
  }

  guardarNuevoPassword(): void {
    this.recuperarError = null;
    this.recuperarExito = null;
    const email = (this.recuperarEmail || '').trim();
    const codigo = (this.recuperarCodigo || '').trim();
    const nuevo = (this.recuperarPasswordNuevo || '').trim();
    const confirmar = (this.recuperarPasswordConfirmar || '').trim();

    if (!nuevo || nuevo.length < 4) {
      this.recuperarError = 'La nueva contraseña debe tener al minímo 4 caracteres.';
      return;
    }
    if (nuevo !== confirmar) {
      this.recuperarError = 'Las contraseñas no coinciden. Verifica e intenta nuevamente.';
      return;
    }

    this.recuperarCargando = true;
    this.authService.restablecerPassword({ email, codigo, passwordNuevo: nuevo }).subscribe({
      next: () => {
        this.recuperarCargando = false;
        this.recuperarExito = '¡Tu contraseña fue actualizada con éxito! Ahora puedes iniciar sesión.';
        this.loginForm.patchValue({ username: email, password: '' });
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('paulcars_password_cambiada_' + email, 'true');
        }
        setTimeout(() => {
          this.cerrarModalRecuperar();
        }, 1600);
      },
      error: (err) => {
        this.recuperarCargando = false;
        this.recuperarError = err?.error?.message || 'No se pudo actualizar la contraseña.';
      }
    });
  }
}