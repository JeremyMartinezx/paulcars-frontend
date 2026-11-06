import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../core/service/auth.service';

@Component({
  selector: 'app-solicitar-cuenta',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './solicitar-cuenta.component.html',
  styleUrl: './solicitar-cuenta.component.css'
})
export class SolicitarCuentaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly exito = signal(false);
  ocultarPassword = true;
  ocultarConfirmPassword = true;

  readonly registroForm = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
    terminos: [false, [Validators.requiredTrue]]
  });

  onTelefonoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 9);
    this.registroForm.controls.telefono.setValue(input.value);
  }

  registrar(): void {
    this.error.set(null);

    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    const { nombres, apellidos, telefono, email, password, confirmPassword, terminos } = this.registroForm.getRawValue();

    if (password !== confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    if (!terminos) {
      this.error.set('Debes aceptar los términos y condiciones.');
      return;
    }

    this.cargando.set(true);

    this.authService.registro({
      username: email.trim(),
      password,
      emailRecuperacion: email.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      telefono: telefono.trim()
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.exito.set(true);
        setTimeout(() => {
          this.router.navigate(['/catalogo']);
        }, 1500);
      },
      error: (err) => {
        this.cargando.set(false);
        console.error('Error al registrar cliente:', err);
        const msg = err.error?.message || 'No se pudo crear la cuenta. Es posible que el correo electrónico ya esté en uso.';
        this.error.set(msg);
      }
    });
  }
}