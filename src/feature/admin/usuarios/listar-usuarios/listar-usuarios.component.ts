import { NgClass } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Usuario } from '../../../../core/models/usuario.model';
import { AuthService } from '../../../../core/service/auth.service';
import { UsuarioService } from '../../../../core/service/usuario.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { UsuarioFormDialogComponent } from '../usuario-form-dialog/usuario-form-dialog.component';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';

export type FiltroRol = 'TODOS' | 'ADMIN' | 'ASESOR';

@Component({
  selector: 'app-listar-usuarios',
  imports: [
    NgClass,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    BackButtonComponent
  ],
  templateUrl: './listar-usuarios.component.html',
  styleUrls: ['./listar-usuarios.component.css']
})
export class ListarUsuariosComponent implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  readonly columnas = ['id', 'usuario', 'rol', 'estado', 'acciones'];

  readonly busqueda = signal('');
  readonly filtroRol = signal<FiltroRol>('TODOS');
  readonly usuarios = this.usuarioService.usuarios;
  readonly miUsuario = computed(() => this.authService.usuarioActual()?.username);

  readonly staffUsuarios = computed(() => {
    return this.usuarios().filter(
      (u) => (u.rol?.nombreRol || '').toUpperCase() !== 'CLIENTE'
    );
  });

  readonly totalStaff = computed(() => this.staffUsuarios().length);

  readonly conteoAdmin = computed(() => {
    return this.staffUsuarios().filter((u) => {
      const r = (u.rol?.nombreRol || '').toUpperCase();
      return r === 'ADMIN' || r.includes('ADMIN');
    }).length;
  });

  readonly conteoAsesor = computed(() => {
    return this.staffUsuarios().filter((u) => {
      const r = (u.rol?.nombreRol || '').toUpperCase();
      return r === 'ASESOR' || r === 'EMPLEADO' || r.includes('ASESOR') || r.includes('VENTA');
    }).length;
  });

  filtrarPorRol(rol: FiltroRol): void {
    this.filtroRol.set(rol);
    this.paginaActual.set(1);
  }

  readonly usuariosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const rol = this.filtroRol();

    return this.staffUsuarios().filter((u) => {
      const r = (u.rol?.nombreRol || '').toUpperCase();
      let matchRol = true;
      if (rol === 'ADMIN') matchRol = r === 'ADMIN' || r.includes('ADMIN');
      else if (rol === 'ASESOR') matchRol = r === 'ASESOR' || r === 'EMPLEADO' || r.includes('ASESOR') || r.includes('VENTA');

      if (!matchRol) return false;

      if (!texto) return true;
      const matchId = u.idUsuario ? String(u.idUsuario).includes(texto) || `#${u.idUsuario}`.includes(texto) : false;
      const matchTexto = `${u.username} ${u.nombreCompleto || ''} ${this.etiquetaRol(u.rol?.nombreRol)}`.toLowerCase().includes(texto);
      return matchId || matchTexto;
    });
  });

  readonly paginaActual = signal(1);
  readonly tamanoPagina = signal(6);

  readonly totalPaginas = computed(() => {
    const total = this.usuariosFiltrados().length;
    return Math.max(1, Math.ceil(total / this.tamanoPagina()));
  });

  readonly usuariosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.usuariosFiltrados().slice(inicio, inicio + this.tamanoPagina());
  });

  readonly rangoInicio = computed(() => {
    if (this.usuariosFiltrados().length === 0) return 0;
    return (this.paginaActual() - 1) * this.tamanoPagina() + 1;
  });

  readonly rangoFin = computed(() => {
    return Math.min(this.paginaActual() * this.tamanoPagina(), this.usuariosFiltrados().length);
  });

  readonly paginasArray = computed(() => {
    const total = this.totalPaginas();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) {
      this.paginaActual.set(p);
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

  ngOnInit(): void {
    this.usuarioService.cargar();
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  abrirNuevo(): void {
    const ref = this.dialog.open(UsuarioFormDialogComponent, { width: '520px' });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      this.usuarioService.crear(resultado).subscribe({
        next: () => {
          this.snackBar.open('Usuario creado correctamente', 'Cerrar', { duration: 5000 });
          this.paginaActual.set(1);
        },
        error: (err) => this.mostrarError(err, 'crear el usuario')
      });
    });
  }

  abrirEditar(usuario: Usuario): void {
    const ref = this.dialog.open(UsuarioFormDialogComponent, {
      width: '520px',
      data: { usuario }
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      this.usuarioService.actualizar(usuario.idUsuario!, resultado).subscribe({
        next: () => this.snackBar.open('Usuario actualizado correctamente', 'Cerrar', { duration: 5000 }),
        error: (err) => this.mostrarError(err, 'actualizar el usuario')
      });
    });
  }

  cambiarEstado(usuario: Usuario): void {
    const activar = !usuario.estado;

    const data: ConfirmDialogData = {
      titulo: activar ? 'Activar usuario' : 'Desactivar usuario',
      subtitulo: 'Gestión de credenciales de usuario',
      icono: activar ? 'how_to_reg' : 'person_off',
      mensaje: activar
        ? `¿Activar a ${usuario.username}? Podrá volver a iniciar sesión.`
        : `¿Desactivar a ${usuario.username}? No podrá iniciar sesión hasta que lo reactives. Su historial no se borra.`
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { data, width: '420px', autoFocus: false });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.usuarioService.cambiarEstado(usuario.idUsuario!, activar).subscribe({
        next: () => this.snackBar.open(activar ? 'Usuario activado' : 'Usuario desactivado', 'Cerrar', { duration: 5000 }),
        error: (err) => this.mostrarError(err, 'actualizar el usuario')
      });
    });
  }

  eliminarUsuario(usuario: Usuario): void {
    const data: ConfirmDialogData = {
      titulo: 'Eliminar usuario',
      subtitulo: 'Acción irreversible en el sistema',
      tipo: 'eliminar',
      icono: 'person_remove',
      mensaje: `¿Estás seguro de eliminar permanentemente al usuario ${usuario.username}? Esta acción no se puede deshacer.`
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { data, width: '420px', autoFocus: false });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.usuarioService.eliminar(usuario.idUsuario!).subscribe({
        next: () => this.snackBar.open('Usuario eliminado exitosamente', 'Cerrar', { duration: 5000 }),
        error: (err) => this.mostrarError(err, 'eliminar el usuario')
      });
    });
  }

  claseEstado(estado: boolean): string {
    return estado ? 'estado-activo' : 'estado-inactivo';
  }

  etiquetaRol(rolNombre?: string): string {
    const r = (rolNombre || '').toUpperCase();
    if (r === 'ADMIN') return 'Administrador';
    if (r === 'EMPLEADO' || r === 'ASESOR') return 'Asesor de Ventas';
    return r;
  }

  claseRol(rolNombre?: string): string {
    const r = (rolNombre || '').toUpperCase();
    if (r === 'ADMIN') return 'badge-rol-admin';
    return 'badge-rol-asesor';
  }

  private mostrarError(err: any, accion: string): void {
    const mensaje = err?.error?.message || err?.error || `No se pudo ${accion}.`;
    this.snackBar.open(typeof mensaje === 'string' ? mensaje : `No se pudo ${accion}.`, 'Cerrar', { duration: 5000 });
  }
}
