import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

/**
 * Functional Guard que valida la autenticación del usuario
 * y verifica la posesión de roles permitidos.
 */
export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.estaAutenticado()) {
    return router.createUrlTree(['/login']);
  }

  const rolesPermitidos = route.data?.['roles'] as string[] | undefined;
  if (rolesPermitidos && !authService.tieneRol(rolesPermitidos)) {
    return router.createUrlTree(['/']);
  }

  return true;
};

/**
 * Guard específico para acceso exclusivo de Administrador (CanActivate y CanMatch)
 */
export const adminGuard: CanActivateFn & CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.estaAutenticado()) {
    return router.createUrlTree(['/login']);
  }

  if (!authService.tieneRol(['ADMIN'])) {
    return router.createUrlTree(['/']);
  }

  return true;
};

/**
 * Guard para personal operativo (Administrador o Empleado / Asesor de counter)
 */
export const staffGuard: CanActivateFn & CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.estaAutenticado()) {
    return router.createUrlTree(['/login']);
  }

  if (!authService.tieneRol(['ADMIN', 'EMPLEADO'])) {
    return router.createUrlTree(['/']);
  }

  return true;
};

/**
 * Guard para portal exclusivo de clientes
 */
export const clienteGuard: CanActivateFn & CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.estaAutenticado()) {
    return router.createUrlTree(['/login']);
  }

  if (!authService.tieneRol(['CLIENTE'])) {
    return router.createUrlTree(['/']);
  }

  return true;
};
