import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Catalogos, Combustible, Marca, Modelo, TipoVehiculo } from '../models/catalogo.model';

@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/catalogos`;

  obtenerTodos(): Observable<Catalogos> {
    return this.http.get<Catalogos>(this.apiUrl);
  }

  crearMarca(nombreMarca: string): Observable<Marca> {
    return this.http.post<Marca>(`${this.apiUrl}/marcas`, { nombreMarca });
  }

  actualizarMarca(id: number, nombreMarca: string): Observable<Marca> {
    return this.http.put<Marca>(`${this.apiUrl}/marcas/${id}`, { nombreMarca });
  }

  crearModelo(modelo: string, idMarca: number): Observable<Modelo> {
    return this.http.post<Modelo>(`${this.apiUrl}/modelos`, { modelo, marca: { idMarca } });
  }

  actualizarModelo(id: number, modelo: string, idMarca: number): Observable<Modelo> {
    return this.http.put<Modelo>(`${this.apiUrl}/modelos/${id}`, { modelo, marca: { idMarca } });
  }

  crearTipoVehiculo(nombreTipo: string): Observable<TipoVehiculo> {
    return this.http.post<TipoVehiculo>(`${this.apiUrl}/tipos-vehiculo`, { nombreTipo });
  }

  actualizarTipoVehiculo(id: number, nombreTipo: string): Observable<TipoVehiculo> {
    return this.http.put<TipoVehiculo>(`${this.apiUrl}/tipos-vehiculo/${id}`, { nombreTipo });
  }

  crearCombustible(nombreCombustible: string): Observable<Combustible> {
    return this.http.post<Combustible>(`${this.apiUrl}/combustibles`, { nombreCombustible });
  }

  actualizarCombustible(id: number, nombreCombustible: string): Observable<Combustible> {
    return this.http.put<Combustible>(`${this.apiUrl}/combustibles/${id}`, { nombreCombustible });
  }
}