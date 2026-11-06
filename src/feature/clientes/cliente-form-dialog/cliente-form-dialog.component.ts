import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Cliente } from '../../../core/models/cliente.model';

export interface ClienteDialogData {
  cliente?: Cliente;
}

@Component({
  selector: 'app-cliente-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './cliente-form-dialog.component.html',
  styleUrl: './cliente-form-dialog.component.css'
})
export class ClienteFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ClienteFormDialogComponent>);
  readonly data: ClienteDialogData = inject(MAT_DIALOG_DATA);

  readonly esEdicion = !!this.data?.cliente;

  form = this.fb.nonNullable.group({
    _esEdicion: [this.esEdicion],
    nombres: [this.data?.cliente?.nombres ?? '', [Validators.required, Validators.minLength(2)]],
    apellidos: [this.data?.cliente?.apellidos ?? '', [Validators.required, Validators.minLength(2)]],
    tipoDocumento: ['DNI', [Validators.required]],
    numeroDocumento: [
      this.data?.cliente?.numeroDocumento ?? '',
      [Validators.required, Validators.pattern(/^\d{8}$/)]
    ],
    email: [this.data?.cliente?.email ?? '', [Validators.required, Validators.email]],
    telefono: [
      this.data?.cliente?.telefono ?? '',
      [Validators.required, Validators.pattern(/^9\d{8}$/)]
    ],
    licenciaConducir: [
      this.data?.cliente?.licenciaConducir ?? '',
      [Validators.required, Validators.pattern(/^[A-Za-z]\d{8}$/)]
    ]
  });

  ngOnInit(): void {
    if (!this.esEdicion) {
      // Asegurar que el campo de email inicie limpio
      this.form.patchValue({ email: '' });
      setTimeout(() => {
        this.form.patchValue({ email: '' });
        this.form.get('email')?.markAsUntouched();
        this.form.get('email')?.markAsPristine();
      }, 50);
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const docLimpio = valor.numeroDocumento.trim();
    const resultado: any = {
      nombres: valor.nombres.trim(),
      apellidos: valor.apellidos.trim(),
      tipoDocumento: 'DNI',
      numeroDocumento: docLimpio,
      telefono: valor.telefono.trim(),
      email: valor.email.trim(),
      licenciaConducir: valor.licenciaConducir.trim().toUpperCase()
    };

    if (!this.esEdicion) {
      // Su DNI por primera vez será su contraseña de acceso
      resultado.password = docLimpio;
    }

    this.dialogRef.close(resultado);
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}