import { Component, Inject, OnInit, Optional, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Rol, Usuario } from '../../../../core/models/usuario.model';
import { UsuarioService } from '../../../../core/service/usuario.service';

function validadorCorporativo(control: AbstractControl): ValidationErrors | null {
  const val = control.value;
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  if (!str.endsWith('@paulcars.com')) {
    return { emailCorporativo: true };
  }
  return null;
}

@Component({
  selector: 'app-usuario-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './usuario-form-dialog.component.html',
  styleUrl: './usuario-form-dialog.component.css'
})
export class UsuarioFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<UsuarioFormDialogComponent>);
  private readonly usuarioService = inject(UsuarioService);

  roles: Rol[] | null = null;
  readonly usuarioParaEditar: Usuario | undefined;
  readonly esEdicion: boolean;

  constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data?: { usuario?: Usuario }) {
    this.usuarioParaEditar = data?.usuario;
    this.esEdicion = !!this.usuarioParaEditar;
  }

  form = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.minLength(2)]],
    apellidos: ['', [Validators.required, Validators.minLength(2)]],
    dni: ['', [Validators.required, Validators.pattern('^[0-9]{8}$')]],
    rolNombre: ['EMPLEADO', [Validators.required]],
    username: ['', [Validators.required, validadorCorporativo]],
    emailRecuperacion: ['']
  });

  ngOnInit(): void {
    if (this.usuarioService.usuarios().length === 0) {
      this.usuarioService.cargar();
    }

    if (this.esEdicion && this.usuarioParaEditar) {
      const u = this.usuarioParaEditar;
      const nombresSplit = u.nombres || this.extraerPrimerNombre(u.nombreCompleto);
      const apellidosSplit = u.apellidos || this.extraerApellidos(u.nombreCompleto);

      this.form.patchValue({
        nombres: nombresSplit,
        apellidos: apellidosSplit,
        dni: u.dni || '',
        rolNombre: u.rol?.nombreRol || 'EMPLEADO',
        username: u.username || '',
        emailRecuperacion: u.emailRecuperacion || u.username || ''
      });
    }

    this.usuarioService.listarRoles().subscribe({
      next: (data) => (this.roles = data.filter((r) => r.nombreRol.toUpperCase() !== 'CLIENTE')),
      error: (err) => console.error('Error cargando roles:', err)
    });
  }

  onNombreApellidoChange(): void {
    if (this.esEdicion) return;
    this.generarCorreoAutomatico();
  }

  generarCorreoAutomatico(): void {
    const nom = this.form.controls.nombres.value.trim();
    const ape = this.form.controls.apellidos.value.trim();

    if (!nom || !ape) {
      this.form.controls.username.setValue('');
      this.form.controls.emailRecuperacion.setValue('');
      return;
    }

    const primerNombre = this.normalizarTexto(nom.split(' ')[0]);
    const primerApellido = this.normalizarTexto(ape.split(' ')[0]);
    const base = `${primerNombre}.${primerApellido}`;
    const baseEmail = `${base}@paulcars.com`;

    // Buscar usuarios existentes para verificar si el correo base ya está en uso
    const usuariosExistentes = this.usuarioService.usuarios();
    const baseEnUso = usuariosExistentes.some(
      (u) => (u.username || '').toLowerCase().trim() === baseEmail
    );

    let correoFinal = baseEmail;
    if (baseEnUso) {
      // Si dos personas tienen el mismo nombre y apellido, se añade correlativo a partir del 2
      const numerosUsados = new Set<number>();
      for (const u of usuariosExistentes) {
        const uEmail = (u.username || '').toLowerCase().trim();
        const regex = new RegExp(`^${base}(\\d+)@paulcars\\.com$`);
        const match = uEmail.match(regex);
        if (match) {
          numerosUsados.add(parseInt(match[1], 10));
        }
      }

      let siguienteNumero = 2;
      while (numerosUsados.has(siguienteNumero)) {
        siguienteNumero++;
      }
      correoFinal = `${base}${siguienteNumero}@paulcars.com`;
    }

    this.form.controls.username.setValue(correoFinal);
    this.form.controls.emailRecuperacion.setValue(correoFinal);
  }

  private normalizarTexto(txt: string): string {
    return txt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/gi, 'n')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  private extraerPrimerNombre(nombreCompleto?: string | null): string {
    if (!nombreCompleto) return '';
    const partes = nombreCompleto.trim().split(' ');
    return partes[0] || '';
  }

  private extraerApellidos(nombreCompleto?: string | null): string {
    if (!nombreCompleto) return '';
    const partes = nombreCompleto.trim().split(' ');
    if (partes.length <= 1) return '';
    return partes.slice(1).join(' ');
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const nombres = valores.nombres.trim();
    const apellidos = valores.apellidos.trim();
    const nombreCompleto = `${nombres} ${apellidos}`.trim();
    const dni = valores.dni.trim();
    const username = valores.username.trim();

    const request: any = {
      username: username,
      rolNombre: valores.rolNombre,
      emailRecuperacion: username,
      nombres: nombres,
      apellidos: apellidos,
      nombreCompleto: nombreCompleto,
      dni: dni
    };

    if (!this.esEdicion) {
      request.password = dni; // En creación, contraseña por defecto = DNI
    }

    this.dialogRef.close(request);
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
