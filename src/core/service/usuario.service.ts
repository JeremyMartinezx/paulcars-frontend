import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { CrearUsuarioRequest, Rol, Usuario } from '../models/usuario.model';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;

  private readonly usuariosSignal = signal<Usuario[]>([]);
  readonly usuarios = this.usuariosSignal.asReadonly();

  cargar(): void {
    this.http.get<Usuario[]>(this.apiUrl).subscribe({
      next: (data) => this.usuariosSignal.set(
        [...data].sort((a, b) => (b.idUsuario ?? 0) - (a.idUsuario ?? 0))
      ),
      error: (err) => console.error('Error cargando usuarios:', err)
    });
  }

  crear(request: CrearUsuarioRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, request).pipe(
      tap((nuevo) => this.usuariosSignal.update((lista) => [nuevo, ...lista]))
    );
  }

  cambiarEstado(idUsuario: number, estado: boolean): Observable<Usuario> {
    const url = `${this.apiUrl}/${idUsuario}/estado?estado=${estado}`;
    return this.http.put<Usuario>(url, null).pipe(
      tap(() => this.cargar())
    );
  }

  actualizar(idUsuario: number, request: Partial<CrearUsuarioRequest>): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${idUsuario}`, request).pipe(
      tap(() => this.cargar())
    );
  }

  eliminar(idUsuario: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idUsuario}`).pipe(
      tap(() => this.cargar())
    );
  }

  listarRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/roles`);
  }
}
