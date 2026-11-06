import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, UsuarioSesion } from '../models/auth.models';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly tokenKey = 'paulcars_token';
  private readonly userKey = 'paulcars_user';

  private readonly usuarioSignal = signal<UsuarioSesion | null>(this.getStoredUser());

  readonly usuarioActual = computed(() => this.usuarioSignal());
  readonly estaAutenticado = computed(() => !!this.usuarioSignal());
  readonly rolActual = computed(() => this.usuarioSignal()?.rol ?? null);

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => this.guardarSesion(response))
    );
  }

  registro(data: {
    username: string;
    password: string;
    emailRecuperacion: string;
    nombres?: string;
    apellidos?: string;
    telefono?: string;
  }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/registro`, data).pipe(
      tap((response) => this.guardarSesion(response))
    );
  }

  logout(redirectTo: string = '/login'): void {
    const token = this.getToken();
    if (token) {
      // Notificar al backend para revocar el token en la lista negra
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        error: () => {}
      });
    }
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.usuarioSignal.set(null);
    this.router.navigate([redirectTo]);
  }

  solicitarCodigoRecuperacion(email: string): Observable<{ exito: boolean; mensaje: string; correoEnviado?: boolean }> {
    return this.http.post<{ exito: boolean; mensaje: string; correoEnviado?: boolean }>(
      `${this.apiUrl}/recuperar-password/solicitar-codigo`,
      { email }
    );
  }

  validarCodigoRecuperacion(email: string, codigo: string): Observable<{ valido: boolean; mensaje: string }> {
    return this.http.post<{ valido: boolean; mensaje: string }>(
      `${this.apiUrl}/recuperar-password/validar-codigo`,
      { email, codigo }
    );
  }

  restablecerPassword(payload: { email: string; codigo: string; passwordNuevo: string }): Observable<{ exito: boolean; mensaje: string }> {
    return this.http.post<{ exito: boolean; mensaje: string }>(
      `${this.apiUrl}/recuperar-password/cambiar-password`,
      payload
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  tieneRol(rolesPermitidos: string[]): boolean {
    const rol = this.rolActual();
    return !!rol && rolesPermitidos.includes(rol);
  }

  private guardarSesion(response: LoginResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    const usuario: UsuarioSesion = {
      username: response.username,
      rol: response.rol,
      nombre: response.nombre,
      email: response.email
    };
    localStorage.setItem(this.userKey, JSON.stringify(usuario));
    this.usuarioSignal.set(usuario);
  }

  // Vuelve a pedir nombre y correo al backend (GET /api/auth/me).
  // Sirve para sesiones guardadas antes de este cambio, que no tenían el nombre real.
  refrescarPerfil(): void {
    if (!this.getToken()) return;
    this.http.get<{ username: string; rol: string; nombre: string; email: string }>(`${this.apiUrl}/me`).subscribe({
      next: (me) => {
        const actual = this.usuarioSignal();
        if (!actual) return;
        const usuario: UsuarioSesion = { ...actual, nombre: me.nombre, email: me.email };
        localStorage.setItem(this.userKey, JSON.stringify(usuario));
        this.usuarioSignal.set(usuario);
      },
      error: () => undefined
    });
  }

  private getStoredUser(): UsuarioSesion | null {
    const stored = localStorage.getItem(this.userKey);
    return stored ? JSON.parse(stored) as UsuarioSesion : null;
  }
}