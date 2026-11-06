import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, of, switchMap, tap, timer } from 'rxjs';

import { environment } from '../../environments/environment';
import { NotificacionApi } from '../models/notificacion.model';

// Notificaciones en vivo del asesor y del administrador.
// Usa "polling": cada 30 segundos pregunta al backend si hay solicitudes nuevas.
@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notificaciones`;
  private readonly intervaloMs = 30_000;

  private readonly listaSignal = signal<NotificacionApi[]>([]);
  readonly notificaciones = this.listaSignal.asReadonly();
  readonly sinLeer = computed(() => this.listaSignal().filter((n) => !n.leida).length);

  private polling?: Subscription;

  // timer(0, 30000) emite al instante y luego cada 30 s; switchMap cancela la consulta anterior si sigue en curso
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

  detener(): void {
    this.polling?.unsubscribe();
    this.polling = undefined;
    this.listaSignal.set([]);
  }

  marcarLeida(clave: string): Observable<unknown> {
    // Se marca en pantalla al instante y luego se guarda en el backend
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
