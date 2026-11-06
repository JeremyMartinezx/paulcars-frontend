import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/service/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.split('?')[0].split('#')[0])
    ),
    { initialValue: typeof window !== 'undefined' ? window.location.pathname.split('?')[0].split('#')[0] : '' }
  );

  readonly rol = computed(() => this.authService.rolActual());
  readonly estaAutenticado = computed(() => this.authService.estaAutenticado());
  readonly esCliente = computed(() => this.rol() === 'CLIENTE');

  readonly esVistaAdminOAsesor = computed(() => {
    const url = this.currentUrl();
    const rol = this.rol();
    if (url.startsWith('/admin') || url.startsWith('/empleado')) {
      return true;
    }
    if ((rol === 'ADMIN' || rol === 'EMPLEADO') && (url.startsWith('/alquileres') || url.startsWith('/vehiculos') || url.startsWith('/clientes'))) {
      return true;
    }
    return false;
  });
}
