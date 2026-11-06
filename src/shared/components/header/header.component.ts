import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthService } from '../../../core/service/auth.service';
import { AlquilerService } from '../../../core/service/alquiler.service';
import { ClienteService } from '../../../core/service/cliente.service';
import { NotificacionService } from '../../../core/service/notificacion.service';
import { motivoRechazoLegible } from '../../../core/utils/reglas-negocio.util';

export interface NotificacionItem {
  id: number;
  // Solo notificaciones del asesor/admin (vienen del backend)
  clave?: string;
  idAlquiler?: number;
  tipoApi?: 'NUEVA_RESERVA' | 'RECORDATORIO_DEVOLUCION';
  titulo: string;
  mensaje: string;
  fecha: string;
  tipo: 'aprobado' | 'recordatorio' | 'inspeccion' | 'info';
  leida: boolean;
  icono: string;
  badgeTexto?: string;
}

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly alquilerService = inject(AlquilerService);
  private readonly clienteService = inject(ClienteService);
  private readonly router = inject(Router);
  private readonly notificacionService = inject(NotificacionService);

  readonly passwordPersonalizadoSignal = signal<boolean>(false);

  readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.split('#')[0].split('?')[0])
    ),
    { initialValue: typeof window !== 'undefined' ? window.location.pathname.split('#')[0].split('?')[0] : '' }
  );

  readonly estaAutenticado = computed(() => this.authService.estaAutenticado());
  readonly rol = computed(() => this.authService.rolActual());
  readonly esCliente = computed(() => this.rol() === 'CLIENTE');
  readonly esAdmin = computed(() => this.rol() === 'ADMIN');
  readonly esEmpleado = computed(() => this.rol() === 'EMPLEADO');
  readonly rutaInicio = computed(() => {
    if (this.esAdmin()) return '/admin';
    if (this.esEmpleado()) return '/empleado';
    return '/';
  });

  // Asesor y admin: nombre real que manda el backend (admin = "Paul Cars Administrador").
  // Cliente: su primer nombre.
  readonly nombreUsuarioVisual = computed(() => {
    const usuario = this.authService.usuarioActual();
    if (!usuario) return 'Usuario';
    if (usuario.rol !== 'CLIENTE' && usuario.nombre) {
      return usuario.nombre;
    }
    if (usuario.nombre) {
      const primer = usuario.nombre.trim().split(/\s+/)[0];
      if (primer) return primer;
    }
    const u = usuario.username || '';
    const base = (u.includes('@') ? u.split('@')[0] : u).replace(/[0-9_.-]+/g, ' ').trim();
    const primer = base.split(/\s+/)[0] || 'Usuario';
    return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase();
  });

  // Correo oficial que se muestra debajo del nombre
  readonly correoUsuarioVisual = computed(() => {
    const usuario = this.authService.usuarioActual();
    return usuario?.email || (usuario?.username?.includes('@') ? usuario.username : '');
  });

  readonly etiquetaRol = computed(() => {
    switch (this.rol()) {
      case 'ADMIN': return 'Administrador';
      case 'EMPLEADO': return 'Asesor de Ventas';
      default: return 'Cliente';
    }
  });

  readonly esReservarActivo = computed(() => {
    const url = this.currentPath();
    return url === '/reservar' || url.startsWith('/reservar/');
  });

  constructor() {
    // La campana en vivo corre para todos los usuarios autenticados (cliente, asesor, admin) desde el backend
    effect(() => {
      const autenticado = this.estaAutenticado();
      if (autenticado) {
        this.notificacionService.iniciar();
      } else {
        this.notificacionService.detener();
      }
    });
  }

  ngOnInit(): void {
    if (typeof localStorage !== 'undefined') {
      const user = this.authService.usuarioActual();
      const uKey = user?.username || 'cliente';
      if (localStorage.getItem('paulcars_password_cambiada_' + uKey) === 'true') {
        this.passwordPersonalizadoSignal.set(true);
      }
      localStorage.removeItem('paulcars_notif_pwd_' + uKey);
    }
    if (this.estaAutenticado()) {
      // Trae nombre real y correo (sesiones guardadas antes no los tenÃƒÂ­an)
      this.authService.refrescarPerfil();
    }
    if (this.estaAutenticado() && this.esCliente()) {
      this.alquilerService.cargarMisAlquileres();
      this.clienteService.obtenerMiPerfil().subscribe({
        next: (c) => {
          if (c?.passwordPersonalizado) {
            const uKey = this.authService.usuarioActual()?.username || 'cliente';
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('paulcars_password_cambiada_' + uKey, 'true');
            }
            this.passwordPersonalizadoSignal.set(true);
          }
        }
      });
    }
  }



  // Notificaciones unificadas conectadas 100% al backend (calculadas en Spring Boot y persistidas en BD)
  readonly notificaciones = computed<NotificacionItem[]>(() => {
    const apiList = this.notificacionService.notificaciones();
    if (!apiList || apiList.length === 0) return [];

    return apiList.map((n, idx): NotificacionItem => {
      const tipoApi = n.tipo || '';
      let icono = 'notifications';
      let badgeTexto = '';
      let tipoItem: 'aprobado' | 'recordatorio' | 'inspeccion' | 'info' = 'recordatorio';

      if (tipoApi === 'DEVOLUCION_1H') {
        icono = 'access_time';
        badgeTexto = 'RETORNO < 1H';
        tipoItem = 'recordatorio';
      } else if (tipoApi === 'DEVOLUCION_2H') {
        icono = 'schedule';
        badgeTexto = 'RETORNO ~2H';
        tipoItem = 'recordatorio';
      } else if (tipoApi === 'DEVOLUCION_VENCIDA') {
        icono = 'warning';
        badgeTexto = 'RETRASO DEVOLUCIÓN';
        tipoItem = 'recordatorio';
      } else if (tipoApi === 'DEVOLUCION_HOY') {
        icono = 'today';
        badgeTexto = 'RETORNO HOY';
        tipoItem = 'recordatorio';
      } else if (tipoApi === 'ALERTA_STOCK') {
        icono = 'inventory_2';
        badgeTexto = 'STOCK CRÍTICO';
        tipoItem = 'recordatorio';
      } else if (tipoApi === 'RESUMEN_EJECUTIVO') {
        icono = 'analytics';
        badgeTexto = 'RESUMEN';
        tipoItem = 'info';
      } else if (tipoApi === 'MANTENIMIENTO_FLOTA') {
        icono = 'build';
        badgeTexto = 'TALLER';
        tipoItem = 'inspeccion';
      } else if (tipoApi === 'AUDITORIA_LIQUIDACION') {
        icono = 'policy';
        badgeTexto = 'AUDITORÍA';
        tipoItem = 'inspeccion';
      } else if (tipoApi === 'RECOJO_HOY') {
        icono = 'event_available';
        badgeTexto = 'RECOJO HOY';
        tipoItem = 'aprobado';
      } else if (tipoApi === 'RESERVA_APROBADA') {
        icono = 'check_circle';
        badgeTexto = 'APROBADA';
        tipoItem = 'aprobado';
      } else if (tipoApi === 'ALQUILER_FINALIZADO') {
        icono = 'verified';
        badgeTexto = 'GARANTIA LIBERADA';
        tipoItem = 'inspeccion';
      } else if (tipoApi === 'CERRADO_CON_DEUDA') {
        icono = 'receipt_long';
        badgeTexto = 'DEUDA';
        tipoItem = 'inspeccion';
      } else if (tipoApi === 'SOLICITUD_RECHAZADA') {
        icono = 'gpp_bad';
        badgeTexto = 'RECHAZADA';
        tipoItem = 'recordatorio';
      } else if (tipoApi === 'SOLICITUD_PENDIENTE') {
        icono = 'pending_actions';
        badgeTexto = 'EN REVISION';
        tipoItem = 'info';
      } else if (tipoApi === 'NUEVA_RESERVA') {
        icono = 'assignment_late';
        badgeTexto = 'VALIDAR EN COUNTER';
        tipoItem = 'aprobado';
      } else if (tipoApi === 'RECORDATORIO_DEVOLUCION') {
        icono = 'car_crash';
        badgeTexto = 'CHECK-OUT';
        tipoItem = 'recordatorio';
      } else if (tipoApi === 'ACTUALIZA_PERFIL') {
        icono = 'manage_accounts';
        badgeTexto = 'PERFIL PENDIENTE';
        tipoItem = 'info';
      } else {
        icono = 'notifications';
        badgeTexto = 'AVISO';
        tipoItem = 'info';
      }

      return {
        id: idx + 1,
        clave: n.clave,
        idAlquiler: n.idAlquiler,
        tipoApi: n.tipo as any,
        titulo: n.titulo,
        mensaje: n.mensaje,
        fecha: n.fecha,
        tipo: tipoItem,
        leida: n.leida,
        icono: icono,
        badgeTexto: badgeTexto
      };
    });
  });

  readonly notificacionesSinLeer = computed(
    () => this.notificaciones().filter((n) => !n.leida).length
  );

  marcarTodasComoLeidas(): void {
    this.notificacionService.marcarTodas().subscribe();
  }

  // Al hacer clic: se marca como leÃƒÂ­da en backend y se redirige
  marcarComoLeida(n: NotificacionItem): void {
    if (n.clave) {
      this.notificacionService.marcarLeida(n.clave).subscribe();
    }
    const rol = this.rol();
    if (rol === 'ADMIN') {
      const tipo = n.tipoApi as string;
      if (tipo === 'ALERTA_STOCK' || tipo === 'MANTENIMIENTO_FLOTA') {
        this.router.navigate(['/vehiculos']);
        return;
      }
      if (tipo === 'RESUMEN_EJECUTIVO') {
        this.router.navigate(['/admin']);
        return;
      }
      if (tipo === 'AUDITORIA_LIQUIDACION') {
        this.router.navigate(['/alquileres']);
        return;
      }
      this.router.navigate(['/alquileres']);
      return;
    }
    if (rol === 'EMPLEADO') {
      const base = '/empleado/alquileres';
      const accion = (n.tipoApi === 'NUEVA_RESERVA' || (n.tipoApi as string) === 'SOLICITUD_PENDIENTE') ? 'aprobar' : ((n.tipoApi as string) === 'RESERVA_APROBADA' || (n.tipoApi as string) === 'PAGO_CONFIRMADO') ? 'entregar' : 'checkout';
      this.router.navigate([base], { queryParams: { reservaId: n.idAlquiler, accion } });
      return;
    }

    if ((n.tipoApi as string) === 'ACTUALIZA_PERFIL') { this.router.navigate(['/cliente/perfil']); return; }
    this.router.navigate(['/cliente/reservas']);
  }

  irAInicio(): void {
    if (this.esAdmin()) {
      this.router.navigate(['/admin']);
      return;
    }
    if (this.esEmpleado()) {
      this.router.navigate(['/empleado']);
      return;
    }
    this.router.navigate(['/']);
  }

  cerrarSesion(): void {
    this.authService.logout('/');
  }
}
