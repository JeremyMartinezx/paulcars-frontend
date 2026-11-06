import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Alquiler } from '../../../core/models/alquiler.model';
import { Cliente } from '../../../core/models/cliente.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { etiquetaEstadoAlquiler } from '../../../core/utils/reglas-negocio.util';

export interface HistorialClienteData {
  cliente: Cliente;
}

// Consulta de historial del cliente (asesor y admin)
@Component({
  selector: 'app-historial-cliente-dialog',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './historial-cliente-dialog.component.html',
  styleUrl: './historial-cliente-dialog.component.css'
})
export class HistorialClienteDialogComponent implements OnInit {
  readonly data: HistorialClienteData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<HistorialClienteDialogComponent>);
  private readonly alquilerService = inject(AlquilerService);

  readonly alquileres = signal<Alquiler[] | null>(null);
  readonly etiquetaEstado = etiquetaEstadoAlquiler;

  // Paginación compacta: exactamente 3 alquileres por página para que no se expanda verticalmente
  readonly paginaActual = signal(1);
  readonly itemsPorPagina = 3;

  readonly totalPaginas = computed(() => {
    const total = this.alquileres()?.length ?? 0;
    return Math.ceil(total / this.itemsPorPagina) || 1;
  });

  readonly alquileresPaginados = computed(() => {
    const list = this.alquileres() ?? [];
    const inicio = (this.paginaActual() - 1) * this.itemsPorPagina;
    return list.slice(inicio, inicio + this.itemsPorPagina);
  });

  readonly paginasArray = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1)
  );

  readonly rangoInicio = computed(() => {
    const total = this.alquileres()?.length ?? 0;
    return total === 0 ? 0 : (this.paginaActual() - 1) * this.itemsPorPagina + 1;
  });

  readonly rangoFin = computed(() => {
    const total = this.alquileres()?.length ?? 0;
    return Math.min(this.paginaActual() * this.itemsPorPagina, total);
  });

  irAPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas()) {
      this.paginaActual.set(p);
    }
  }

  paginaAnterior(): void {
    if (this.paginaActual() > 1) {
      this.paginaActual.update(p => p - 1);
    }
  }

  paginaSiguiente(): void {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.update(p => p + 1);
    }
  }

  ngOnInit(): void {
    this.alquilerService.listarPorCliente(this.data.cliente.idCliente!).subscribe({
      next: (lista) => {
        this.alquileres.set([...lista].sort((a, b) => (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0)));
        this.paginaActual.set(1);
      },
      error: () => this.alquileres.set([])
    });
  }

  claseEstado(estado?: string | null): string {
    const est = (estado || '').toUpperCase();
    if (est === 'PENDIENTE') return 'badge-pendiente';
    if (est === 'RESERVADO' || est === 'APROBADO' || est === 'CONFIRMADO' || est === 'PAGADO') return 'badge-reservado-pagado';
    if (est === 'PAGO_EN_REVISION') return 'badge-revision';
    if (est === 'ACTIVO' || est === 'EN_CURSO' || est === 'EN CURSO') return 'badge-en-ruta';
    if (est === 'FINALIZADO') return 'badge-finalizado';
    if (est === 'CANCELADO' || est === 'RECHAZADO' || est === 'DESESTIMADO') return 'badge-cancelado';
    return 'badge-finalizado';
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
