import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { Alquiler, AlquilerCounterRequest, RechazoReservaRequest } from '../models/alquiler.model';
import { CheckoutRequest, LiquidacionResponse } from '../models/liquidacion.model';

export interface DisponibilidadHorarios {
  sede: string;
  fecha: string;
  disponible: boolean;
  mensaje: string;
  horarios: string[];
  proximaFechaDisponible?: string;
  proximoHorarioDisponible?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlquilerService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/alquileres`;

  obtenerDisponibilidadHorarios(sede: string, fecha: string): Observable<DisponibilidadHorarios> {
    const params = new HttpParams()
      .set('sede', sede)
      .set('fecha', fecha);
    return this.http.get<DisponibilidadHorarios>(`${this.apiUrl}/horarios`, { params });
  }

  private readonly alquileresSignal = signal<Alquiler[]>([]);
  readonly alquileres = this.alquileresSignal.asReadonly();

  private readonly misAlquileresSignal = signal<Alquiler[]>([]);
  readonly misAlquileres = this.misAlquileresSignal.asReadonly();

  cargar(): void {
    this.http.get<Alquiler[]>(this.apiUrl).subscribe({
      next: (data) => this.alquileresSignal.set(
        [...data].sort((a, b) => (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0))
      ),
      error: (err) => console.error('Error cargando alquileres:', err)
    });
  }

  cargarMisAlquileres(): void {
    this.http.get<Alquiler[]>(`${this.apiUrl}/mis-alquileres`).subscribe({
      next: (data) => this.misAlquileresSignal.set(
        [...data].sort((a, b) => (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0))
      ),
      error: (err) => {
        console.error('Error cargando mis alquileres:', err);
        this.misAlquileresSignal.set([]);
      }
    });
  }

  agregar(
    idCliente: number,
    idVehiculo: number,
    fechaInicio: string,
    fechaFin: string,
    sedeRecojo?: string,
    sedeDevolucion?: string,
    horaRecojo?: string,
    horaDevolucion?: string,
    dias?: number,
    precioBase?: number,
    montoExtras?: number,
    precioTotal?: number,
    serviciosExtras?: string
  ): Observable<Alquiler> {
    let params = new HttpParams()
      .set('idCliente', idCliente)
      .set('idVehiculo', idVehiculo)
      .set('inicio', fechaInicio)
      .set('fin', fechaFin);

    if (sedeRecojo) params = params.set('sedeRecojo', sedeRecojo);
    if (sedeDevolucion) params = params.set('sedeDevolucion', sedeDevolucion);
    if (horaRecojo) params = params.set('horaRecojo', horaRecojo);
    if (horaDevolucion) params = params.set('horaDevolucion', horaDevolucion);
    if (dias) params = params.set('dias', dias.toString());
    if (precioBase !== undefined && precioBase !== null) params = params.set('precioBase', precioBase.toString());
    if (montoExtras !== undefined && montoExtras !== null) params = params.set('montoExtras', montoExtras.toString());
    if (precioTotal !== undefined && precioTotal !== null) params = params.set('precioTotal', precioTotal.toString());
    if (serviciosExtras) params = params.set('serviciosExtras', serviciosExtras);

    return this.http.post<Alquiler>(this.apiUrl, null, { params }).pipe(
      tap((nuevo) => {
        this.alquileresSignal.update((lista) => [nuevo, ...lista]);
        this.misAlquileresSignal.update((lista) => [nuevo, ...lista]);
      })
    );
  }

  // POST /api/alquileres/{id}/aprobar: valida requisitos y confirma la reserva
  aprobar(idAlquiler: number): Observable<Alquiler> {
    return this.http.post<Alquiler>(`${this.apiUrl}/${idAlquiler}/aprobar`, null).pipe(
      tap(() => {
        this.cargar();
        this.cargarMisAlquileres();
      })
    );
  }

  // PUT /api/alquileres/{id}/entregar-llaves: activa contrato pagado anticipadamente tras retener el depósito de garantía
  entregarLlaves(idAlquiler: number): Observable<Alquiler> {
    return this.http.put<Alquiler>(`${this.apiUrl}/${idAlquiler}/entregar-llaves`, null).pipe(
      tap(() => {
        this.cargar();
        this.cargarMisAlquileres();
      })
    );
  }

  cancelar(idAlquiler: number): Observable<Alquiler> {
    return this.http.put<Alquiler>(`${this.apiUrl}/${idAlquiler}/cancelar`, null).pipe(
      tap(() => {
        this.cargar();
        this.cargarMisAlquileres();
      })
    );
  }

  // POST /api/alquileres/{id}/rechazar: causal formal + correo al cliente
  rechazar(idAlquiler: number, request: RechazoReservaRequest): Observable<Alquiler> {
    return this.http.post<Alquiler>(`${this.apiUrl}/${idAlquiler}/rechazar`, request).pipe(
      tap(() => this.cargar())
    );
  }

  // POST /api/alquileres/counter: alquiler presencial con extras (precio calculado en el backend)
  crearEnCounter(request: AlquilerCounterRequest): Observable<Alquiler> {
    return this.http.post<Alquiler>(`${this.apiUrl}/counter`, request).pipe(
      tap((nuevo) => this.alquileresSignal.update((lista) => [nuevo, ...lista]))
    );
  }

  // POST /api/alquileres/{id}/checkout-inspeccion: liquidación técnica y cierre del contrato
  checkout(idAlquiler: number, request: CheckoutRequest): Observable<LiquidacionResponse> {
    return this.http.post<LiquidacionResponse>(`${this.apiUrl}/${idAlquiler}/checkout-inspeccion`, request).pipe(
      tap(() => this.cargar())
    );
  }

  // GET /api/alquileres/{id}/acta: acta de liquidación ya emitida
  obtenerActa(idAlquiler: number): Observable<LiquidacionResponse> {
    return this.http.get<LiquidacionResponse>(`${this.apiUrl}/${idAlquiler}/acta`);
  }

  obtenerPorId(idAlquiler: number): Observable<Alquiler> {
    return this.http.get<Alquiler>(`${this.apiUrl}/${idAlquiler}`);
  }

  // Historial de un cliente (consulta del asesor)
  listarPorCliente(idCliente: number): Observable<Alquiler[]> {
    return this.http.get<Alquiler[]>(`${this.apiUrl}/cliente/${idCliente}`);
  }
}
