import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';

import { Catalogos } from '../../../core/models/catalogo.model';
import { CatalogoService } from '../../../core/service/catalogo.service';
import { AuthService } from '../../../core/service/auth.service';
import { BackButtonComponent } from '../../../shared/components/back-button/back-button.component';

type TipoCatalogo = 'marca' | 'tipo' | 'combustible';

interface EdicionModelo {
  id: number;
  nombre: string;
  idMarca: number | null;
}

@Component({
  selector: 'app-catalogo-base',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    BackButtonComponent
  ],
  templateUrl: './catalogo-base.component.html',
  styleUrls: ['./catalogo-base.component.css']
})
export class CatalogoBaseComponent implements OnInit {
  // El asesor ve los catálogos en modo solo lectura; solo el admin crea y edita
  private readonly authService = inject(AuthService);
  readonly esAdmin = computed(() => this.authService.rolActual() === 'ADMIN');

  private readonly catalogoService = inject(CatalogoService);
  private readonly snackBar = inject(MatSnackBar);

  catalogos: Catalogos | null = null;

  nuevaMarca = '';
  nuevoTipo = '';
  nuevoCombustible = '';
  nuevoModeloNombre = '';
  nuevoModeloMarcaId: number | null = null;

  editandoSimple: { tipo: TipoCatalogo; id: number; valor: string } | null = null;
  editandoModelo: EdicionModelo | null = null;

  busqueda = signal('');
  filtroMarcaModelo = signal<number | 'TODAS'>('TODAS');

  readonly marcasFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const lista = this.catalogos?.marcas || [];
    if (!q) return lista;
    return lista.filter((m) => m.nombreMarca.toLowerCase().includes(q));
  });

  readonly modelosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const filtroMarca = this.filtroMarcaModelo();
    let lista = this.catalogos?.modelos || [];

    if (filtroMarca !== 'TODAS') {
      lista = lista.filter((m) => m.marca?.idMarca === filtroMarca);
    }

    if (!q) return lista;
    return lista.filter((m) =>
      m.modelo.toLowerCase().includes(q) || (m.marca?.nombreMarca || '').toLowerCase().includes(q)
    );
  });

  readonly tiposFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const lista = this.catalogos?.tiposVehiculo || [];
    if (!q) return lista;
    return lista.filter((t) => t.nombreTipo.toLowerCase().includes(q));
  });

  readonly combustiblesFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const lista = this.catalogos?.combustibles || [];
    if (!q) return lista;
    return lista.filter((c) => c.nombreCombustible.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.cargarCatalogos();
  }

  private cargarCatalogos(): void {
    this.catalogoService.obtenerTodos().subscribe({
      next: (data) => (this.catalogos = data),
      error: (err) => {
        console.error('Error cargando catálogos:', err);
        this.snackBar.open('No se pudo cargar el catálogo', 'Cerrar', { duration: 5000 });
      }
    });
  }

  agregarSimple(tipo: TipoCatalogo): void {
    const valor = (tipo === 'marca' ? this.nuevaMarca : tipo === 'tipo' ? this.nuevoTipo : this.nuevoCombustible).trim();
    if (!valor) return;

    const peticion: Observable<any> =
      tipo === 'marca'
        ? this.catalogoService.crearMarca(valor)
        : tipo === 'tipo'
          ? this.catalogoService.crearTipoVehiculo(valor)
          : this.catalogoService.crearCombustible(valor);

    peticion.subscribe({
      next: () => {
        if (tipo === 'marca') this.nuevaMarca = '';
        if (tipo === 'tipo') this.nuevoTipo = '';
        if (tipo === 'combustible') this.nuevoCombustible = '';
        this.cargarCatalogos();
        this.snackBar.open('Agregado correctamente', 'Cerrar', { duration: 5000 });
      },
      error: (err) => this.mostrarError(err)
    });
  }

  iniciarEdicionSimple(tipo: TipoCatalogo, id: number, valorActual: string): void {
    this.editandoSimple = { tipo, id, valor: valorActual };
  }

  cancelarEdicionSimple(): void {
    this.editandoSimple = null;
  }

  guardarEdicionSimple(): void {
    if (!this.editandoSimple) return;
    const { tipo, id, valor } = this.editandoSimple;
    if (!valor.trim()) return;

    const peticion: Observable<any> =
      tipo === 'marca'
        ? this.catalogoService.actualizarMarca(id, valor.trim())
        : tipo === 'tipo'
          ? this.catalogoService.actualizarTipoVehiculo(id, valor.trim())
          : this.catalogoService.actualizarCombustible(id, valor.trim());

    peticion.subscribe({
      next: () => {
        this.editandoSimple = null;
        this.cargarCatalogos();
        this.snackBar.open('Actualizado correctamente', 'Cerrar', { duration: 5000 });
      },
      error: (err) => this.mostrarError(err)
    });
  }

  agregarModelo(): void {
    const nombre = this.nuevoModeloNombre.trim();
    if (!nombre || !this.nuevoModeloMarcaId) return;

    this.catalogoService.crearModelo(nombre, this.nuevoModeloMarcaId).subscribe({
      next: () => {
        this.nuevoModeloNombre = '';
        this.nuevoModeloMarcaId = null;
        this.cargarCatalogos();
        this.snackBar.open('Modelo agregado correctamente', 'Cerrar', { duration: 5000 });
      },
      error: (err) => this.mostrarError(err)
    });
  }

  iniciarEdicionModelo(id: number, nombre: string, idMarca: number): void {
    this.editandoModelo = { id, nombre, idMarca };
  }

  cancelarEdicionModelo(): void {
    this.editandoModelo = null;
  }

  guardarEdicionModelo(): void {
    if (!this.editandoModelo) return;
    const { id, nombre, idMarca } = this.editandoModelo;
    if (!nombre.trim() || !idMarca) return;

    this.catalogoService.actualizarModelo(id, nombre.trim(), idMarca).subscribe({
      next: () => {
        this.editandoModelo = null;
        this.cargarCatalogos();
        this.snackBar.open('Modelo actualizado correctamente', 'Cerrar', { duration: 5000 });
      },
      error: (err) => this.mostrarError(err)
    });
  }

  private mostrarError(err: any): void {
    const mensaje = err?.error?.message || err?.error;
    this.snackBar.open(typeof mensaje === 'string' ? mensaje : 'Ocurrió un error, intenta de nuevo.', 'Cerrar', {
      duration: 5000
    });
  }
}