import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { huboCambios } from '../utils/comparar.util';

import {
  Alquiler,
  AlquilerCounterRequest,
  CancelarReservaRequest,
  Devolucion,
  EntregaRequest,
  HistorialEstado,
  PreviaCancelacion,
  RechazoReservaRequest,
  ResultadoCancelacion,
  UnidadDisponible
} from '../models/alquiler.model';
import { CargosPrevios, CheckoutRequest, LiquidacionResponse } from '../models/liquidacion.model';
import { DanosAlquiler, PagoDeudaRequest, TasacionRequest, TasacionResultado } from '../models/dano.model';

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

  // Todos los cambios de estado (sirven para ordenar por llegada / salida de un estado)
  private readonly historialSignal = signal<HistorialEstado[]>([]);
  readonly historialEstados = this.historialSignal.asReadonly();

  cargar(): void {
    this.http.get<Alquiler[]>(this.apiUrl).subscribe({
      next: (data) => {
        const lista = [...data].sort((a, b) => (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0));
        if (huboCambios(this.alquileresSignal(), lista)) this.alquileresSignal.set(lista);
      },
      error: (err) => console.error('Error cargando alquileres:', err)
    });
    this.http.get<HistorialEstado[]>(`${this.apiUrl}/historial-estados`).subscribe({
      next: (data) => { if (huboCambios(this.historialSignal(), data)) this.historialSignal.set(data); },
      error: () => { /* se conserva lo último que se vio hasta el siguiente intento */ }
    });
  }

  // Qué pasaría si se cancelara ahora (porcentaje y monto de devolución según la política)
  previaCancelacion(idAlquiler: number, motivo: string): Observable<PreviaCancelacion> {
    return this.http.get<PreviaCancelacion>(`${this.apiUrl}/${idAlquiler}/cancelacion/previa`, { params: { motivo } });
  }

  cancelarReserva(idAlquiler: number, request: CancelarReservaRequest): Observable<ResultadoCancelacion> {
    return this.http.post<ResultadoCancelacion>(`${this.apiUrl}/${idAlquiler}/cancelar-reserva`, request).pipe(
      tap(() => this.cargar())
    );
  }

  unidadesDisponibles(idAlquiler: number): Observable<UnidadDisponible[]> {
    return this.http.get<UnidadDisponible[]>(`${this.apiUrl}/${idAlquiler}/unidades-disponibles`);
  }

  cambiarUnidad(idAlquiler: number, placa: string, motivo: string): Observable<ResultadoCancelacion> {
    return this.http.put<ResultadoCancelacion>(`${this.apiUrl}/${idAlquiler}/cambiar-unidad`, { placa, motivo }).pipe(
      tap(() => this.cargar())
    );
  }

  historialDe(idAlquiler: number): Observable<HistorialEstado[]> {
    return this.http.get<HistorialEstado[]>(`${this.apiUrl}/${idAlquiler}/historial`);
  }

  cargarMisAlquileres(): void {
    this.http.get<Alquiler[]>(`${this.apiUrl}/mis-alquileres`).subscribe({
      next: (data) => {
        const lista = [...data].sort((a, b) => (b.idAlquiler ?? 0) - (a.idAlquiler ?? 0));
        if (huboCambios(this.misAlquileresSignal(), lista)) this.misAlquileresSignal.set(lista);
      },
      error: (err) => {
        console.error('Error cargando mis alquileres:', err);
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

  
  aprobar(idAlquiler: number): Observable<Alquiler> {
    return this.http.post<Alquiler>(`${this.apiUrl}/${idAlquiler}/aprobar`, null).pipe(
      tap(() => {
        this.cargar();
        this.cargarMisAlquileres();
      })
    );
  }

  
  entregarLlaves(idAlquiler: number, acta: EntregaRequest): Observable<Alquiler> {
    return this.http.put<Alquiler>(`${this.apiUrl}/${idAlquiler}/entregar-llaves`, acta).pipe(
      tap(() => {
        this.cargar();
        this.cargarMisAlquileres();
      })
    );
  }

  cargosPrevios(idAlquiler: number, combustible: string, momento?: string): Observable<CargosPrevios> {
    const params: Record<string, string> = { combustible };
    if (momento) params['momento'] = momento;
    return this.http.get<CargosPrevios>(`${this.apiUrl}/${idAlquiler}/cargos-previos`, { params });
  }

  cancelar(idAlquiler: number): Observable<Alquiler> {
    return this.http.put<Alquiler>(`${this.apiUrl}/${idAlquiler}/cancelar`, null).pipe(
      tap(() => {
        this.cargar();
        this.cargarMisAlquileres();
      })
    );
  }

  
  rechazar(idAlquiler: number, request: RechazoReservaRequest): Observable<Alquiler> {
    return this.http.post<Alquiler>(`${this.apiUrl}/${idAlquiler}/rechazar`, request).pipe(
      tap(() => this.cargar())
    );
  }

  
  crearEnCounter(request: AlquilerCounterRequest): Observable<Alquiler> {
    return this.http.post<Alquiler>(`${this.apiUrl}/counter`, request).pipe(
      tap((nuevo) => this.alquileresSignal.update((lista) => [nuevo, ...lista]))
    );
  }

  
  // ───── Daños del vehículo ─────

  subirFotoDano(archivo: File): Observable<{ url: string }> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<{ url: string }>(`${this.apiUrl}/danos/fotos`, datos);
  }

  danos(idAlquiler: number): Observable<DanosAlquiler> {
    return this.http.get<DanosAlquiler>(`${this.apiUrl}/${idAlquiler}/danos`);
  }

  vistaPreviaTasacion(idAlquiler: number, request: TasacionRequest): Observable<TasacionResultado> {
    return this.http.post<TasacionResultado>(`${this.apiUrl}/${idAlquiler}/danos/vista-previa`, request);
  }

  tasarDanos(idAlquiler: number, request: TasacionRequest): Observable<DanosAlquiler> {
    return this.http.post<DanosAlquiler>(`${this.apiUrl}/${idAlquiler}/danos/tasacion`, request).pipe(tap(() => this.cargar()));
  }

  cobrarDeuda(idAlquiler: number, request: PagoDeudaRequest): Observable<DanosAlquiler> {
    return this.http.post<DanosAlquiler>(`${this.apiUrl}/${idAlquiler}/deuda/pago`, request).pipe(tap(() => this.cargar()));
  }

  checkout(idAlquiler: number, request: CheckoutRequest): Observable<LiquidacionResponse> {
    return this.http.post<LiquidacionResponse>(`${this.apiUrl}/${idAlquiler}/checkout-inspeccion`, request).pipe(
      tap(() => this.cargar())
    );
  }

  
  obtenerActa(idAlquiler: number): Observable<LiquidacionResponse> {
    return this.http.get<LiquidacionResponse>(`${this.apiUrl}/${idAlquiler}/acta`);
  }

  obtenerPorId(idAlquiler: number): Observable<Alquiler> {
    return this.http.get<Alquiler>(`${this.apiUrl}/${idAlquiler}`);
  }

  
  listarPorCliente(idCliente: number): Observable<Alquiler[]> {
    return this.http.get<Alquiler[]>(`${this.apiUrl}/cliente/${idCliente}`);
  }

  // ── Documentos PDF ──

  descargarComprobante(idAlquiler: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${idAlquiler}/comprobante`, { responseType: 'blob' });
  }

  // Acta de finalización: solo existe cuando el alquiler ya fue devuelto
  descargarActaFinalizacion(idAlquiler: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${idAlquiler}/acta-finalizacion`, { responseType: 'blob' });
  }

  descargarActaEntrega(idAlquiler: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${idAlquiler}/acta-entrega`, { responseType: 'blob' });
  }

  enviarComprobantePorCorreo(idAlquiler: number): Observable<{ enviado: boolean; correo: string }> {
    return this.http.post<{ enviado: boolean; correo: string }>(`${this.apiUrl}/${idAlquiler}/comprobante/enviar`, null);
  }

  // ── Devolución de dinero de reservas canceladas ──

  private readonly devolucionesSignal = signal<Record<number, Devolucion>>({});
  readonly devoluciones = this.devolucionesSignal.asReadonly();
  private readonly devolucionesPedidas = new Set<number>();

  devolucion(idAlquiler: number): Observable<Devolucion> {
    return this.http.get<Devolucion>(`${this.apiUrl}/${idAlquiler}/devolucion`);
  }

  descargarNotaCredito(idAlquiler: number, idBoleta: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${idAlquiler}/notas-credito/${idBoleta}`, { responseType: 'blob' });
  }

  guardarDevolucion(d: Devolucion): void {
    this.devolucionesSignal.update((m) => ({ ...m, [d.idAlquiler]: d }));
  }

  // Trae la devolución de las reservas canceladas que todavía no se consultaron (para mostrar el botón solo si hubo pago)
  precargarDevoluciones(alquileres: Alquiler[]): void {
    for (const a of alquileres) {
      const id = a.idAlquiler;
      if (!id || (a.estado?.nombreEstado || '').toUpperCase() !== 'CANCELADO' || this.devolucionesPedidas.has(id)) continue;
      this.devolucionesPedidas.add(id);
      this.devolucion(id).subscribe({
        next: (d) => this.guardarDevolucion(d),
        error: () => this.devolucionesPedidas.delete(id)
      });
    }
  }
}
