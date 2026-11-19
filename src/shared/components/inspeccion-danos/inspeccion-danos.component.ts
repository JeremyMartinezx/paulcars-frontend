import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  Dano,
  DanoRequest,
  GRAVEDADES_DANO,
  TIPOS_DANO,
  ZONAS_DANO,
  etiquetaGravedad,
  etiquetaTipoDano,
  etiquetaZona
} from '../../../core/models/dano.model';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { resolverUrlImagen } from '../../../core/utils/imagen-url.util';

// Lista de daños de una inspección: cada daño lleva zona, tipo, gravedad, descripción y una foto como evidencia.
// Se usa al entregar (daños que el vehículo ya tiene) y al recibir (daños nuevos).
@Component({
  selector: 'app-inspeccion-danos',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './inspeccion-danos.component.html',
  styleUrl: './inspeccion-danos.component.css'
})
export class InspeccionDanosComponent {
  private readonly alquilerService = inject(AlquilerService);

  // Daños registrados (enlace bidireccional con la pantalla que lo usa)
  readonly danos = model<DanoRequest[]>([]);
  // Texto cuando no hay ningún daño
  readonly textoSinDanos = input('Sin daños registrados.');
  // Daños de referencia (por ejemplo, los que ya tenía al entregarlo): solo lectura
  readonly referencia = input<Dano[]>([]);
  readonly tituloReferencia = input('Al entregar el vehículo');

  readonly zonas = ZONAS_DANO;
  readonly tipos = TIPOS_DANO;
  readonly gravedades = GRAVEDADES_DANO;
  readonly etiquetaZona = etiquetaZona;
  readonly etiquetaTipo = etiquetaTipoDano;
  readonly etiquetaGravedad = etiquetaGravedad;
  readonly foto = resolverUrlImagen;

  // Formulario de un daño
  // true mientras el formulario de un daño está abierto y sin agregar: la pantalla que lo usa no debe confirmar todavía
  readonly abierto = model<boolean>(false);
  zona = 'FRENTE';
  tipo = 'RAYON';
  gravedad = 'LEVE';
  descripcion = '';
  readonly fotoUrl = signal('');
  readonly subiendo = signal(false);
  readonly error = signal<string | null>(null);

  readonly hayDanos = computed(() => this.danos().length > 0);

  abrir(): void {
    this.abierto.set(true);
    this.error.set(null);
  }

  cancelar(): void {
    this.limpiar();
  }

  elegirFoto(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.error.set(null);
    this.subiendo.set(true);
    this.alquilerService.subirFotoDano(archivo).subscribe({
      next: (r) => {
        this.fotoUrl.set(r.url);
        this.subiendo.set(false);
      },
      error: (err) => {
        this.subiendo.set(false);
        this.error.set(err?.error?.message || 'No se pudo subir la foto. Use una imagen JPG, PNG o WEBP de hasta 5 MB.');
      }
    });
  }

  quitarFoto(): void {
    this.fotoUrl.set('');
  }

  agregar(): void {
    if (this.descripcion.trim().length < 3) {
      this.error.set('Describa el daño con algunas palabras.');
      return;
    }
    if (!this.fotoUrl()) {
      this.error.set('Adjunte una foto del daño: es la evidencia que respalda cualquier cobro.');
      return;
    }
    this.danos.update((lista) => [
      ...lista,
      {
        zona: this.zona,
        tipo: this.tipo,
        gravedad: this.gravedad,
        descripcion: this.descripcion.trim(),
        fotoUrl: this.fotoUrl()
      }
    ]);
    this.limpiar();
  }

  quitar(indice: number): void {
    this.danos.update((lista) => lista.filter((_, i) => i !== indice));
  }

  private limpiar(): void {
    this.abierto.set(false);
    this.zona = 'FRENTE';
    this.tipo = 'RAYON';
    this.gravedad = 'LEVE';
    this.descripcion = '';
    this.fotoUrl.set('');
    this.error.set(null);
  }
}
