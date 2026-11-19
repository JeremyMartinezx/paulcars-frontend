import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, of, switchMap, tap, timer } from 'rxjs';

import { environment } from '../../environments/environment';
import { NotificacionApi } from '../models/notificacion.model';


@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notificaciones`;
  private readonly intervaloMs = 15_000;

  private readonly listaSignal = signal<NotificacionApi[]>([]);
  readonly notificaciones = this.listaSignal.asReadonly();
  readonly sinLeer = computed(() => this.listaSignal().filter((n) => !n.leida).length);

  private polling?: Subscription;

  
  iniciar(): void {
    if (this.polling) return;
    this.polling = timer(0, this.intervaloMs)
      .pipe(
        switchMap(() =>
          this.http.get<NotificacionApi[]>(this.apiUrl).pipe(catchError(() => of(null)))
        )
      )
      .subscribe((lista) => {
        if (lista) this.listaSignal.set(lista);
      });
  }

  // Consulta inmediata (la usa la actualización en vivo cuando el servidor avisa que algo cambió)
  recargar(): void {
    if (!this.polling) return;
    this.http.get<NotificacionApi[]>(this.apiUrl).pipe(catchError(() => of(null))).subscribe((lista) => {
      if (lista) this.listaSignal.set(lista);
    });
  }

  detener(): void {
    this.polling?.unsubscribe();
    this.polling = undefined;
    this.listaSignal.set([]);
  }

  marcarLeida(clave: string): Observable<unknown> {
    
    this.listaSignal.update((l) => l.map((n) => (n.clave === clave ? { ...n, leida: true } : n)));
    return this.http.post(`${this.apiUrl}/${encodeURIComponent(clave)}/leida`, null).pipe(catchError(() => of(null)));
  }

  marcarTodas(): Observable<unknown> {
    const claves = this.listaSignal().filter((n) => !n.leida).map((n) => n.clave);
    this.listaSignal.update((l) => l.map((n) => ({ ...n, leida: true })));
    if (claves.length === 0) return of(null);
    return this.http.post(`${this.apiUrl}/leidas`, claves).pipe(
      tap(() => undefined),
      catchError(() => of(null))
    );
  }
}
