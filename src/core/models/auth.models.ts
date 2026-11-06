export type RolUsuario = 'ADMIN' | 'CLIENTE' | 'EMPLEADO';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UsuarioSesion {
  username: string;
  rol: RolUsuario;
  nombre?: string;
  email?: string;
}

export interface LoginResponse {
  token: string;
  tipo: string;
  username: string;
  rol: RolUsuario;
  nombre?: string;
  email?: string;
}