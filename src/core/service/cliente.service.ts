import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { Cliente } from '../models/cliente.model';

export interface CrearClienteRequest {
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  email: string;
  licenciaConducir: string;
  direccion?: string;
  password?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clientes`;

  private readonly clientesSignal = signal<Cliente[]>([]);
  readonly clientes = this.clientesSignal.asReadonly();

  cargar(): void {
    this.http.get<Cliente[]>(this.apiUrl).subscribe({
      next: (data) => this.clientesSignal.set(
        [...data].sort((a, b) => (b.idCliente ?? 0) - (a.idCliente ?? 0))
      ),
      error: (err) => console.error('Error cargando clientes:', err)
    });
  }

  listarTodos(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.apiUrl);
  }

  obtenerMiPerfil(): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.apiUrl}/mi-perfil`);
  }

  actualizarMiPerfil(datos: Partial<Cliente>): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.apiUrl}/mi-perfil`, datos).pipe(
      tap(() => this.cargar())
    );
  }

  agregar(request: CrearClienteRequest): Observable<Cliente> {
    return this.http.post<Cliente>(this.apiUrl, request).pipe(
      tap((nuevo) => this.clientesSignal.update((lista) => [nuevo, ...lista]))
    );
  }

  actualizar(id: number, cliente: Partial<Cliente>): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.apiUrl}/${id}`, cliente).pipe(
      tap(() => this.cargar())
    );
  }

  solicitarCodigoPassword(): Observable<{ exito: boolean; mensaje: string; codigo?: string }> {
    return this.http.post<{ exito: boolean; mensaje: string; codigo?: string }>(
      `${this.apiUrl}/solicitar-codigo-password`,
      {}
    );
  }

  cambiarPassword(payload: { passwordActual?: string; passwordNuevo: string; codigoVerificacion?: string }): Observable<{ exito: boolean; mensaje: string }> {
    return this.http.post<{ exito: boolean; mensaje: string }>(
      `${this.apiUrl}/cambiar-password`,
      payload
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.cargar())
    );
  }

  // Bloqueo / desbloqueo (solo administrador) - Normalizado a ACTIVO o LISTA_NEGRA
  cambiarEstado(id: number, estado: 'ACTIVO' | 'LISTA_NEGRA' | string): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.apiUrl}/${id}/estado`, null, { params: { estado } }).pipe(
      tap(() => this.cargar())
    );
  }
}
