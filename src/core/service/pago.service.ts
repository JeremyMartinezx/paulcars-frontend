import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject, signal } from '@angular/core';
import { huboCambios } from '../utils/comparar.util';
import { Observable, tap } from 'rxjs';

import {
  Pago,
  RegistrarPagoRequest,
  YapePagoRequest,
  PlinPagoRequest,
  TarjetaPagoRequest,
  TransaccionPagoResponse
} from '../models/pago.model';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/pagos`;

  private readonly pagosSignal = signal<Pago[]>([]);
  readonly pagos = this.pagosSignal.asReadonly();

  cargar(): void {
    this.http.get<Pago[]>(this.apiUrl).subscribe({
      next: (data) => { if (huboCambios(this.pagosSignal(), data)) this.pagosSignal.set(data); },
      error: (err) => console.error('Error cargando pagos:', err)
    });
  }

  pagarConYape(request: YapePagoRequest): Observable<TransaccionPagoResponse> {
    return this.http.post<TransaccionPagoResponse>(`${this.apiUrl}/yape`, request).pipe(
      tap(() => this.cargar())
    );
  }

  pagarConPlin(request: PlinPagoRequest): Observable<TransaccionPagoResponse> {
    return this.http.post<TransaccionPagoResponse>(`${this.apiUrl}/plin`, request).pipe(
      tap(() => this.cargar())
    );
  }

  pagarConTarjeta(request: TarjetaPagoRequest): Observable<TransaccionPagoResponse> {
    return this.http.post<TransaccionPagoResponse>(`${this.apiUrl}/tarjeta`, request).pipe(
      tap(() => this.cargar())
    );
  }

  registrarPago(request: RegistrarPagoRequest): Observable<Pago> {
    return this.http.post<Pago>(this.apiUrl, request).pipe(
      tap(() => this.cargar())
    );
  }

  obtenerSaldo(idAlquiler: number): Observable<{ saldoContrato: number; saldoDeuda: number }> {
    return this.http.get<{ saldoContrato: number; saldoDeuda: number }>(`${this.apiUrl}/alquiler/${idAlquiler}/saldo`);
  }

  descargarRecibo(idPago: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${idPago}/recibo`, { responseType: 'blob' });
  }

  enviarReciboPorCorreo(idPago: number): Observable<{ enviado: boolean; correo: string }> {
    return this.http.post<{ enviado: boolean; correo: string }>(`${this.apiUrl}/${idPago}/recibo/enviar`, null);
  }

  // Pagos de un contrato (para listar sus recibos)
  listarPorAlquiler(idAlquiler: number): Observable<Pago[]> {
    return this.http.get<Pago[]>(`${this.apiUrl}/alquiler/${idAlquiler}`);
  }
}
