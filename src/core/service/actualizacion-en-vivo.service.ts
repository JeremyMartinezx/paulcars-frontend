import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';

import { environment } from '../../environments/environment';
import { AlquilerService } from './alquiler.service';
import { AuthService } from './auth.service';
import { ClienteService } from './cliente.service';
import { NotificacionService } from './notificacion.service';
import { PagoService } from './pago.service';
import { UsuarioService } from './usuario.service';
import { VehiculoService } from './vehiculo.service';

// Mantiene al día las pantallas del administrador, del asesor y del cliente sin recargar la página.
// Cada 2 segundos consulta un número muy liviano que el servidor sube cuando algo cambia
// (reserva, pago, cliente, vehículo, usuario). Solo cuando ese número cambia se vuelven a pedir las listas,
// así los cambios se ven casi al instante y el servidor no se satura.
// Se pausa si la pestaña no se está viendo y se actualiza de inmediato al volver a ella.
@Injectable({ providedIn: 'root' })
export class ActualizacionEnVivoService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly alquilerService = inject(AlquilerService);
  private readonly pagoService = inject(PagoService);
  private readonly clienteService = inject(ClienteService);
  private readonly vehiculoService = inject(VehiculoService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly notificacionService = inject(NotificacionService);

  private readonly intervaloMs = 2000;
  // Respaldo: aunque el número no cambie (por ejemplo, un dato modificado directamente en la base), se refresca cada 30 s
  private readonly respaldoMs = 30000;

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private ultimaVersion: number | null = null;
  private ultimaActualizacion = 0;
  private consultando = false;

  private readonly alVolverALaPestana = () => {
    if (document.visibilityState === 'visible') this.consultar();
  };

  constructor() {
    effect(() => {
      const rol = this.auth.rolActual();
      if (rol === 'ADMIN' || rol === 'EMPLEADO' || rol === 'CLIENTE') this.iniciar();
      else this.detener();
    });
  }

  private iniciar(): void {
    if (this.temporizador) return;
    this.ultimaVersion = null;
    this.ultimaActualizacion = Date.now();
    this.temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') this.consultar();
    }, this.intervaloMs);
    document.addEventListener('visibilitychange', this.alVolverALaPestana);
  }

  private detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.ultimaVersion = null;
    document.removeEventListener('visibilitychange', this.alVolverALaPestana);
  }

  private consultar(): void {
    if (this.consultando) return;
    this.consultando = true;
    this.http.get<{ version: number }>(`${environment.apiUrl}/cambios`).subscribe({
      next: ({ version }) => {
        this.consultando = false;
        // La primera consulta también actualiza: así no se pierde un cambio ocurrido mientras cargaba la página
        const cambio = this.ultimaVersion === null || version !== this.ultimaVersion;
        const respaldo = Date.now() - this.ultimaActualizacion >= this.respaldoMs;
        this.ultimaVersion = version;
        if (cambio || respaldo) this.actualizar();
      },
      error: () => {
        this.consultando = false;
      }
    });
  }

  private actualizar(): void {
    this.ultimaActualizacion = Date.now();
    // El cliente solo ve sus propias reservas: cuando el personal cambia su estado, aparece al instante
    if (this.auth.rolActual() === 'CLIENTE') {
      this.alquilerService.cargarMisAlquileres();
      this.notificacionService.recargar();
      return;
    }
    this.alquilerService.cargar();
    this.pagoService.cargar();
    this.clienteService.cargar();
    this.vehiculoService.recargar();
    this.notificacionService.recargar();
    // La gestión de usuarios es solo del administrador
    if (this.auth.rolActual() === 'ADMIN') this.usuarioService.cargar();
  }
}
