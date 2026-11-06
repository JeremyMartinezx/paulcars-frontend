import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject, signal } from '@angular/core';
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
      next: (data) => this.pagosSignal.set(data),
      error: (err) => console.error('Error cargando pagos:', err)
    });
  }

  // =========================================================================
  // INTEGRACIÓN DE PAGOS (YAPE OTP, PLIN QR, TARJETA DIGITAL Y COUNTER POS)
  // =========================================================================

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

  // El body cambia según el método (efectivo, tarjeta POS, Yape/Plin o transferencia)
  registrarPago(request: RegistrarPagoRequest): Observable<Pago> {
    return this.http.post<Pago>(this.apiUrl, request).pipe(
      tap(() => this.cargar())
    );
  }

  // Cuánto falta pagar del contrato
  obtenerSaldo(idAlquiler: number): Observable<{ saldoContrato: number; saldoDeuda: number }> {
    return this.http.get<{ saldoContrato: number; saldoDeuda: number }>(`${this.apiUrl}/alquiler/${idAlquiler}/saldo`);
  }
}
