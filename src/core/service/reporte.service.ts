import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { CierreCaja, ReporteEjecutivo, ReporteOperativo, ReporteSolicitudes, UnidadOpcion } from '../models/reporte.model';

export interface FiltroReporte {
  desde?: string;
  hasta?: string;
  sede?: string;
  categoria?: string;
  modelo?: string;
  placa?: string;
}

export interface FiltroSolicitudes extends FiltroReporte {
  estado?: string;
  q?: string;
  metodo?: string;
  asesor?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reportes`;

  ejecutivo(filtro: FiltroReporte): Observable<ReporteEjecutivo> {
    let params = new HttpParams();
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    if (filtro.sede && filtro.sede !== 'TODAS') params = params.set('sede', filtro.sede);
    if (filtro.categoria && filtro.categoria !== 'TODAS') params = params.set('categoria', filtro.categoria);
    if (filtro.modelo && filtro.modelo !== 'TODOS') params = params.set('modelo', filtro.modelo);
    if (filtro.placa && filtro.placa !== 'TODAS') params = params.set('placa', filtro.placa);
    return this.http.get<ReporteEjecutivo>(`${this.apiUrl}/ejecutivo`, { params });
  }

  unidades(): Observable<UnidadOpcion[]> {
    return this.http.get<UnidadOpcion[]>(`${this.apiUrl}/unidades`);
  }

  cierreCaja(fecha: string): Observable<CierreCaja> {
    return this.http.get<CierreCaja>(`${this.apiUrl}/cierre-caja`, { params: new HttpParams().set('fecha', fecha) });
  }

  operativo(): Observable<ReporteOperativo> {
    return this.http.get<ReporteOperativo>(`${this.apiUrl}/operativo`);
  }

  ejecutivoExcel(filtro: FiltroReporte): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/ejecutivo/excel`, { params: this.params(filtro), responseType: 'blob' });
  }

  ejecutivoPdf(filtro: FiltroReporte): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/ejecutivo/pdf`, { params: this.params(filtro), responseType: 'blob' });
  }

  solicitudes(filtro: FiltroSolicitudes): Observable<ReporteSolicitudes> {
    return this.http.get<ReporteSolicitudes>(`${this.apiUrl}/solicitudes`, { params: this.params(filtro) });
  }

  solicitudesExcel(filtro: FiltroSolicitudes): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/solicitudes/excel`, { params: this.params(filtro), responseType: 'blob' });
  }

  // Reporte resumido en Excel o PDF, con los cuadros que elige el administrador
  resumen(formato: 'excel' | 'pdf', filtro: FiltroSolicitudes): Observable<Blob> {
    const params = this.params(filtro);
    return this.http.get(`${this.apiUrl}/resumen/${formato}`, { params, responseType: 'blob' });
  }

  private params(filtro: FiltroSolicitudes): HttpParams {
    let params = new HttpParams();
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    if (filtro.estado && filtro.estado !== 'TODOS') params = params.set('estado', filtro.estado);
    if (filtro.sede && filtro.sede !== 'TODAS') params = params.set('sede', filtro.sede);
    if (filtro.categoria && filtro.categoria !== 'TODAS') params = params.set('categoria', filtro.categoria);
    if (filtro.modelo && filtro.modelo !== 'TODOS') params = params.set('modelo', filtro.modelo);
    if (filtro.placa && filtro.placa !== 'TODAS') params = params.set('placa', filtro.placa);
    if (filtro.q && filtro.q.trim()) params = params.set('q', filtro.q.trim());
    if (filtro.metodo && filtro.metodo !== 'TODOS') params = params.set('metodo', filtro.metodo);
    if (filtro.asesor && filtro.asesor !== 'TODOS') params = params.set('asesor', filtro.asesor);
    return params;
  }
}
