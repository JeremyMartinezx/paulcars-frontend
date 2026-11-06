import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../service/auth.service';

/**
 * Functional HTTP Interceptor DevSecOps.
 * - Inyecta de forma segura el Bearer Token en cabeceras HTTP.
 * - Captura centralizadamente errores 401 (Unauthorized) y 403 (Forbidden).
 * - En caso de token revocado, expirado o cuenta inactiva, purga inmediatamente el estado
 *   en memoria y almacenamiento local, redirigiendo al usuario al formulario de autenticación.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Inyección segura de Bearer Token
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 Unauthorized: Sesión expirada o token revocado
      if (error.status === 401 && token && !req.url.includes('/auth/login')) {
        authService.logout('/login');
      }

      // 403 Forbidden: Cuenta inactiva, bloqueada o falta de privilegios
      if (error.status === 403) {
        const errorMsg = typeof error.error === 'string'
          ? error.error
          : (error.error?.message || '');

        if (!req.url.includes('/auth/login') && (errorMsg.toLowerCase().includes('inactiv') || errorMsg.toLowerCase().includes('desactivad') || errorMsg.toLowerCase().includes('no disponible'))) {
          authService.logout('/login');
        }
      }

      return throwError(() => error);
    })
  );
};
