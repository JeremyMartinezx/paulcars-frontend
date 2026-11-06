import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Cliente } from '../../../core/models/cliente.model';
import { AuthService } from '../../../core/service/auth.service';
import { ClienteService } from '../../../core/service/cliente.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ClienteFormDialogComponent } from '../cliente-form-dialog/cliente-form-dialog.component';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';
import { HistorialClienteDialogComponent } from '../historial-cliente-dialog/historial-cliente-dialog.component';


@Component({
  selector: 'app-listar-clientes',
  imports: [
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
  templateUrl: './listar-clientes.component.html',
  styleUrl: './listar-clientes.component.css'
})
export class ListarClientesComponent implements OnInit {
  private readonly clienteService = inject(ClienteService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);

  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');

  readonly columnas = ['cliente', 'documento', 'contacto', 'licencia', 'acciones'];

  readonly busqueda = signal('');
    readonly clientes = this.clienteService.clientes;

  readonly clientesSoloConsumidores = computed(() => {
    return this.clientes().filter(c => {
      const email = (c.email || '').toLowerCase();
      const nombres = (c.nombres || '').toLowerCase();
      const apellidos = (c.apellidos || '').toLowerCase();
      return !email.endsWith('@paulcars.com') &&
             !nombres.includes('administrador') &&
             !apellidos.includes('administrador');
    });
  });

      
  readonly clientesFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const list = this.clientesSoloConsumidores();
    if (!texto) return list;

    return list.filter((c) =>
      `${c.nombres} ${c.apellidos} ${c.numeroDocumento} ${c.email} ${c.telefono} ${c.licenciaConducir}`.toLowerCase().includes(texto)
    );
  });

  readonly paginaActual = signal(1);
  readonly tamanoPagina = signal(6);

  readonly totalPaginas = computed(() => {
    const total = this.clientesFiltrados().length;
    return Math.max(1, Math.ceil(total / this.tamanoPagina()));
  });

  readonly clientesPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.clientesFiltrados().slice(inicio, inicio + this.tamanoPagina());
  });

  readonly rangoInicio = computed(() => {
    if (this.clientesFiltrados().length === 0) return 0;
    return (this.paginaActual() - 1) * this.tamanoPagina() + 1;
  });

  readonly rangoFin = computed(() => {
    return Math.min(this.paginaActual() * this.tamanoPagina(), this.clientesFiltrados().length);
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
    this.clienteService.cargar();
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.paginaActual.set(1);
  }

  
  abrirNuevo(): void {
    const ref = this.dialog.open(ClienteFormDialogComponent, {
      data: {},
      width: '600px'
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      this.clienteService.agregar(resultado).subscribe({
        next: () => {
          
          this.paginaActual.set(1);
        },
        error: (err) => this.mostrarError(err, 'registrar')
      });
    });
  }

  editar(cliente: Cliente): void {
    const ref = this.dialog.open(ClienteFormDialogComponent, {
      data: { cliente },
      width: '600px'
    });

    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;

      this.clienteService.actualizar(cliente.idCliente!, resultado).subscribe({
        next: () => this.clienteService.cargar(),
        error: (err) => this.mostrarError(err, 'actualizar')
      });
    });
  }

  eliminar(cliente: Cliente): void {
    const data: ConfirmDialogData = {
      titulo: 'Eliminar cliente',
      mensaje: `¿Seguro que deseas eliminar a ${cliente.nombres} ${cliente.apellidos}? Esta acción no se puede deshacer.`
    };

    const ref = this.dialog.open(ConfirmDialogComponent, { data, width: '420px', autoFocus: false });

    ref.afterClosed().subscribe((confirmado) => {
      if (!confirmado) return;

      this.clienteService.eliminar(cliente.idCliente!).subscribe({
        next: () => this.clienteService.cargar(),
        error: (err) => this.mostrarError(err, 'eliminar')
      });
    });
  }

  // Consulta de historial (asesor y admin)
  verHistorial(cliente: Cliente): void {
    this.dialog.open(HistorialClienteDialogComponent, {
      data: { cliente },
      width: '680px',
      maxWidth: '96vw'
    });
  }

  
  
  nombreCompleto(cliente: Cliente): string {
    const nom = (cliente?.nombres || '').trim();
    const ape = (cliente?.apellidos || '').trim();
    if (!ape || ape.toLowerCase() === 'por completar') {
      return nom;
    }
    return `${nom} ${ape}`;
  }

  esPerfilIncompleto(cliente: Cliente): boolean {
    const doc = (cliente?.numeroDocumento || '').trim();
    const ape = (cliente?.apellidos || '').trim();
    const lic = (cliente?.licenciaConducir || '').trim();
    const tel = (cliente?.telefono || '').trim();
    return (
      !doc ||
      doc.startsWith('PEND-') ||
      doc === '00000000' ||
      !ape ||
      ape.toLowerCase() === 'por completar' ||
      !lic ||
      lic === '000000000' ||
      !tel ||
      tel === '000000000'
    );
  }

  esDocumentoFaltante(cliente: Cliente): boolean {
    const doc = (cliente?.numeroDocumento || '').trim();
    return !doc || doc.startsWith('PEND-') || doc === '00000000';
  }

  iniciales(cliente: Cliente): string {
    const nombre = this.nombreCompleto(cliente);
    const partes = nombre.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      return `${partes[0].charAt(0)}${partes[1].charAt(0)}`.toUpperCase();
    }
    if (partes.length === 1 && partes[0].length >= 2) {
      return partes[0].substring(0, 2).toUpperCase();
    }
    return (partes[0]?.charAt(0) || 'C').toUpperCase();
  }

  private mostrarError(err: any, accion: string): void {
    const mensaje = err?.error?.message || err?.error || `No se pudo ${accion} el cliente.`;
    this.snackBar.open(typeof mensaje === 'string' ? mensaje : `No se pudo ${accion} el cliente.`, 'Cerrar', { duration: 5000 });
  }
}
