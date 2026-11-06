import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ReporteEjecutivo, ReporteOperativo } from '../models/reporte.model';

export interface FiltroReporte {
  desde?: string;
  hasta?: string;
  sede?: string;
  categoria?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reportes`;

  // Dashboard ejecutivo del administrador
  ejecutivo(filtro: FiltroReporte): Observable<ReporteEjecutivo> {
    let params = new HttpParams();
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    if (filtro.sede && filtro.sede !== 'TODAS') params = params.set('sede', filtro.sede);
    if (filtro.categoria && filtro.categoria !== 'TODAS') params = params.set('categoria', filtro.categoria);
    return this.http.get<ReporteEjecutivo>(`${this.apiUrl}/ejecutivo`, { params });
  }

  // Métricas operativas del día (asesor)
  operativo(): Observable<ReporteOperativo> {
    return this.http.get<ReporteOperativo>(`${this.apiUrl}/operativo`);
  }
}
