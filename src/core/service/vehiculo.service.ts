import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { Vehiculo, VehiculoUnidad } from '../models/vehiculo.model';

@Injectable({
  providedIn: 'root'
})
export class VehiculoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vehiculos`;

  private readonly vehiculosSignal = signal<Vehiculo[]>([]);
  readonly vehiculos = this.vehiculosSignal.asReadonly();

  cargar(sede?: string): void {
    const params = sede && sede !== 'TODAS' ? `?sede=${encodeURIComponent(sede)}` : '';
    this.http.get<Vehiculo[]>(`${this.apiUrl}${params}`).subscribe({
      next: (data) => this.vehiculosSignal.set(
        [...data].sort((a, b) => (b.idVehiculo ?? 0) - (a.idVehiculo ?? 0))
      ),
      error: (err) => console.error('Error cargando vehículos:', err)
    });
  }

  listarTodos(sede?: string): Observable<Vehiculo[]> {
    const params = sede && sede !== 'TODAS' ? `?sede=${encodeURIComponent(sede)}` : '';
    return this.http.get<Vehiculo[]>(`${this.apiUrl}${params}`);
  }

  obtenerPorId(id: number): Observable<Vehiculo> {
    return this.http.get<Vehiculo>(`${this.apiUrl}/${id}`);
  }

  agregar(vehiculo: Vehiculo): Observable<Vehiculo> {
    return this.http.post<Vehiculo>(this.apiUrl, vehiculo).pipe(
      tap((nuevo) => this.vehiculosSignal.update((lista) => [nuevo, ...lista]))
    );
  }

  actualizar(id: number, vehiculo: Vehiculo): Observable<Vehiculo> {
    return this.http.put<Vehiculo>(`${this.apiUrl}/${id}`, vehiculo).pipe(
      tap(() => this.cargar())
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.cargar())
    );
  }

  // Sube una foto y devuelve su URL pública (/uploads/vehiculos/xxx.jpg)
  subirImagen(archivo: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<{ url: string }>(`${this.apiUrl}/imagenes`, formData);
  }

  // ===== Gestión de Unidades Físicas (Flota en Patio) =====
  obtenerUnidades(idModelo: number): Observable<VehiculoUnidad[]> {
    return this.http.get<VehiculoUnidad[]>(`${this.apiUrl}/${idModelo}/unidades`);
  }

  agregarUnidad(idModelo: number, unidad: Partial<VehiculoUnidad>): Observable<VehiculoUnidad> {
    return this.http.post<VehiculoUnidad>(`${this.apiUrl}/${idModelo}/unidades`, unidad).pipe(
      tap(() => this.cargar())
    );
  }

  cambiarEstadoUnidad(idUnidad: number, estado: string): Observable<VehiculoUnidad> {
    return this.http.put<VehiculoUnidad>(`${this.apiUrl}/unidades/${idUnidad}/estado`, null, { params: { estado } }).pipe(
      tap(() => this.cargar())
    );
  }

  eliminarUnidad(idUnidad: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/unidades/${idUnidad}`).pipe(
      tap(() => this.cargar())
    );
  }
}
