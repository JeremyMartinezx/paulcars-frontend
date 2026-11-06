import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin, map, of } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ImagenVehiculo, Vehiculo } from '../../../core/models/vehiculo.model';
import { VehiculoService } from '../../../core/service/vehiculo.service';
import { resolverUrlImagen } from '../../../core/utils/imagen-url.util';
import { obtenerGaleriaVehiculo } from '../../../core/data/vehiculo-galerias.data';
import { Catalogos } from '../../../core/models/catalogo.model';
import { CatalogoService } from '../../../core/service/catalogo.service';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { PagoService } from '../../../core/service/pago.service';

export interface VehiculoDialogData {
  vehiculo?: Vehiculo;
}

// Una de las 4 posiciones de la galería
interface SlotFoto {
  orden: number;
  etiqueta: string;
  url: string;            // URL ya guardada en el backend (o vacía)
  preview: string;        // Lo que se ve en pantalla
  archivo: File | null;   // Foto elegida que aún no se sube
}

const ETIQUETAS_FOTO = ['Foto 1: Frontal 3/4 (principal)', 'Foto 2: Lateral', 'Foto 3: Posterior', 'Foto 4: Habitáculo / Interior'];

@Component({
  selector: 'app-vehiculo-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './vehiculo-form-dialog.component.html',
  styleUrl: './vehiculo-form-dialog.component.css'
})
export class VehiculoFormDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<VehiculoFormDialogComponent>);
  private readonly catalogoService = inject(CatalogoService);
  private readonly alquilerService = inject(AlquilerService);
  private readonly pagoService = inject(PagoService);
  private readonly vehiculoService = inject(VehiculoService);
  readonly data: VehiculoDialogData = inject(MAT_DIALOG_DATA);

  readonly esEdicion = !!this.data?.vehiculo;

  catalogos: Catalogos | null = null;

  // ---- Galería de 4 imágenes ----
  readonly fotos = signal<SlotFoto[]>(this.armarSlots());
  readonly subiendo = signal(false);
  errorFotos: string | null = null;

  /** True cuando el vehículo tiene un alquiler ACTIVO o RESERVADO sin pago registrado */
  readonly tieneAlquilerSinPago = computed(() => {
    const id = this.data?.vehiculo?.idVehiculo;
    if (!id) return false;

    const alquileresVehiculo = this.alquilerService.alquileres().filter(
      (a) => a.vehiculo?.idVehiculo === id &&
        (a.estado?.nombreEstado === 'ACTIVO' || a.estado?.nombreEstado === 'RESERVADO')
    );

    if (alquileresVehiculo.length === 0) return false;

    const pagos = this.pagoService.pagos();
    return alquileresVehiculo.some(
      (a) => !pagos.some((p) => p.alquiler?.idAlquiler === a.idAlquiler)
    );
  });

  form = this.fb.group({
    color: [this.data?.vehiculo?.color ?? '', [Validators.required]],
    anio: [
      this.data?.vehiculo?.anio ?? new Date().getFullYear(),
      [Validators.required, Validators.min(1990), Validators.max(new Date().getFullYear() + 1)]
    ],
    precioDia: [this.data?.vehiculo?.precioDia ?? 0, [Validators.required, Validators.min(1)]],
    idModelo: [this.data?.vehiculo?.modelo?.idModelo ?? null, [Validators.required]],
    idTipo: [this.data?.vehiculo?.tipo?.idTipo ?? null, [Validators.required]],
    idCombustible: [this.data?.vehiculo?.combustible?.idCombustible ?? null, [Validators.required]],
    idEstado: [this.data?.vehiculo?.estado?.idEstado ?? 6],
    sede: [this.data?.vehiculo?.sede ? this.data.vehiculo.sede.toUpperCase() : 'MIRAFLORES']
  });

  /** Únicamente estados a nivel de modelo/vehículo: DISPONIBLE y NO DISPONIBLE */
  get estadosVehiculoGenerales(): { idEstado: number; nombreEstado: string }[] {
    const lista = this.catalogos?.estadosVehiculo ?? [];
    const permitidos = ['DISPONIBLE', 'NO DISPONIBLE'];
    const filtrados = lista.filter((e) => permitidos.includes((e.nombreEstado || '').toUpperCase()));
    if (filtrados.length > 0) {
      return filtrados;
    }
    return [
      { idEstado: 6, nombreEstado: 'DISPONIBLE' },
      { idEstado: 8, nombreEstado: 'NO DISPONIBLE' }
    ];
  }

  ngOnInit(): void {
    this.catalogoService.obtenerTodos().subscribe({
      next: (data) => {
        this.catalogos = data;
        if (this.esEdicion && this.data?.vehiculo) {
          const v = this.data.vehiculo;
          const esDisp = v.activo !== false && (v.estado?.nombreEstado || '').toUpperCase() === 'DISPONIBLE';
          const estadoObj = this.estadosVehiculoGenerales.find(
            (e) => e.nombreEstado.toUpperCase() === (esDisp ? 'DISPONIBLE' : 'NO DISPONIBLE')
          );
          if (estadoObj) {
            this.form.patchValue({ idEstado: estadoObj.idEstado });
          }

          const nom = (v.nombreModelo || v.modelo?.modelo || '').toLowerCase().trim();
          const marcaId = v.marca?.idMarca || v.modelo?.marca?.idMarca;
          const marcaNom = (v.marca?.nombreMarca || v.marca || v.modelo?.marca?.nombreMarca || '').toLowerCase().trim();

          const match = data.modelos?.find((m) => {
            const mNom = (m.modelo || '').toLowerCase().trim();
            const mMarcaId = m.marca?.idMarca;
            const mMarcaNom = (m.marca?.nombreMarca || '').toLowerCase().trim();
            if (marcaId && mMarcaId === marcaId && mNom === nom) return true;
            if (marcaNom && mMarcaNom === marcaNom && mNom === nom) return true;
            return mNom === nom;
          });

          if (match) {
            this.form.patchValue({ idModelo: match.idModelo });
          }
        } else if (!this.esEdicion) {
          const dispObj = this.estadosVehiculoGenerales.find(
            (e) => e.nombreEstado.toUpperCase() === 'DISPONIBLE'
          );
          if (dispObj) {
            this.form.patchValue({ idEstado: dispObj.idEstado });
          }
        }
      },
      error: (err) => console.error('Error cargando catálogos:', err)
    });

    this.alquilerService.cargar();
    this.pagoService.cargar();
  }

  /** Devuelve true si el estado 'DISPONIBLE' debe estar bloqueado */
  estadoEsBloqueado(nombreEstado: string): boolean {
    return nombreEstado.toUpperCase() === 'DISPONIBLE' && this.tieneAlquilerSinPago();
  }

  // ===== Fotos =====

  private armarSlots(): SlotFoto[] {
    const existentes: ImagenVehiculo[] = this.data?.vehiculo?.imagenes ?? [];
    const fallbackFotos = this.data?.vehiculo ? obtenerGaleriaVehiculo(this.data.vehiculo) : [];

    return ETIQUETAS_FOTO.map((etiqueta, idx) => {
      const orden = idx + 1;
      let url = existentes.find((img) => img.orden === orden)?.urlImagen ?? '';
      if (!url && fallbackFotos[idx]?.url) {
        url = fallbackFotos[idx].url;
      }
      if (!url && orden === 1 && this.data?.vehiculo?.imagenUrl) {
        url = this.data.vehiculo.imagenUrl;
      }
      return { orden, etiqueta, url, preview: resolverUrlImagen(url), archivo: null };
    });
  }

  // Previsualización instantánea: el navegador crea una URL temporal del archivo
  elegirFoto(orden: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      this.errorFotos = 'Solo se aceptan imágenes JPG, PNG o WEBP.';
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      this.errorFotos = 'Cada foto puede pesar máximo 5 MB.';
      return;
    }
    this.errorFotos = null;
    this.fotos.update((lista) =>
      lista.map((f) => {
        if (f.orden !== orden) return f;
        if (f.archivo) URL.revokeObjectURL(f.preview);
        return { ...f, archivo, preview: URL.createObjectURL(archivo) };
      })
    );
    input.value = '';
  }

  quitarFoto(orden: number): void {
    this.fotos.update((lista) =>
      lista.map((f) => {
        if (f.orden !== orden) return f;
        if (f.archivo) URL.revokeObjectURL(f.preview);
        return { ...f, archivo: null, url: '', preview: '' };
      })
    );
  }

  ngOnDestroy(): void {
    // Libera las URLs temporales de las previsualizaciones
    this.fotos().forEach((f) => {
      if (f.archivo) URL.revokeObjectURL(f.preview);
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const esDisponible = this.esEdicion
      ? (this.data?.vehiculo?.activo !== false && (this.data?.vehiculo?.estado?.nombreEstado || '').toUpperCase() !== 'NO DISPONIBLE')
      : true;
    const idEstadoFinal = this.esEdicion
      ? (this.data?.vehiculo?.estado?.idEstado || (esDisponible ? 6 : 8))
      : 6;
    const nombreEstadoFinal = esDisponible ? 'DISPONIBLE' : 'NO DISPONIBLE';

    // Un vehículo nuevo debe llegar con su galería completa de 4 fotos
    const completas = this.fotos().filter((f) => f.url || f.archivo).length;
    if (!this.esEdicion && completas < 4) {
      this.errorFotos = 'Carga las 4 fotos del vehículo (frontal, lateral, posterior e interior).';
      return;
    }
    this.errorFotos = null;

    // 1) Sube solo las fotos nuevas; 2) arma el vehículo con todas las URLs
    const pendientes = this.fotos().filter((f) => f.archivo);
    const subidas$ = pendientes.length === 0
      ? of([] as { orden: number; url: string }[])
      : forkJoin(
          pendientes.map((f) =>
            this.vehiculoService.subirImagen(f.archivo!).pipe(map((r) => ({ orden: f.orden, url: r.url })))
          )
        );

    this.subiendo.set(true);
    subidas$.subscribe({
      next: (subidas) => {
        this.subiendo.set(false);
        const imagenes: ImagenVehiculo[] = this.fotos()
          .map((f) => ({ orden: f.orden, urlImagen: subidas.find((x) => x.orden === f.orden)?.url ?? f.url }))
          .filter((img) => !!img.urlImagen);

        const modeloSeleccionado = this.catalogos?.modelos?.find((m) => m.idModelo === valores.idModelo);
        const nombreModeloFinal = modeloSeleccionado?.modelo || this.data?.vehiculo?.nombreModelo || (this.data?.vehiculo as any)?.modelo?.modelo || '';
        const marcaFinal = modeloSeleccionado?.marca || this.data?.vehiculo?.marca || (this.data?.vehiculo as any)?.modelo?.marca;

        const vehiculo: Vehiculo = {
          idModelo: this.data?.vehiculo?.idModelo || this.data?.vehiculo?.idVehiculo,
          idVehiculo: this.data?.vehiculo?.idVehiculo || this.data?.vehiculo?.idModelo,
          nombreModelo: nombreModeloFinal,
          marca: marcaFinal,
          placa: this.data?.vehiculo?.placa || ('MOD-' + (this.data?.vehiculo?.idVehiculo || '001')),
          color: valores.color || 'Blanco',
          anio: valores.anio || new Date().getFullYear(),
          numeroMotor: this.data?.vehiculo?.numeroMotor ?? 'MTR-MOD',
          numeroVin: this.data?.vehiculo?.numeroVin ?? 'VIN-MOD',
          precioDia: valores.precioDia || 0,
          precioHora: Math.round(((valores.precioDia || 0) / 8) * 100) / 100,
          kilometraje: this.data?.vehiculo?.kilometraje ?? 0,
          sede: valores.sede || 'MIRAFLORES',
          activo: esDisponible,
          imagenUrl: imagenes.find((img) => img.orden === 1)?.urlImagen,
          imagenes,
          modelo: modeloSeleccionado ? { idModelo: modeloSeleccionado.idModelo, modelo: modeloSeleccionado.modelo, marca: modeloSeleccionado.marca } : ({ idModelo: valores.idModelo! } as any),
          tipo: { idTipo: valores.idTipo! } as any,
          combustible: { idCombustible: valores.idCombustible! } as any,
          estado: {
            idEstado: idEstadoFinal,
            nombreEstado: nombreEstadoFinal
          } as any
        };

        this.dialogRef.close(vehiculo);
      },
      error: (err) => {
        this.subiendo.set(false);
        this.errorFotos = err?.error?.message || 'No se pudieron subir las fotos. Intenta de nuevo.';
      }
    });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}