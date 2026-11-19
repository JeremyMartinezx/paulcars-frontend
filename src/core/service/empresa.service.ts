import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { environment } from '../../environments/environment';

export interface Empresa {
  razonSocial: string;
  nombreComercial: string;
  ruc: string;
  rucTexto: string;
  direccion: string;
  telefono: string;
  email: string;
  web: string;
}

// Datos de la empresa para el membrete de reportes e impresiones
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);
  private readonly empresaSignal = signal<Empresa | null>(null);
  readonly empresa = this.empresaSignal.asReadonly();

  cargar(): void {
    if (this.empresaSignal() !== null) return;
    this.http.get<Empresa>(`${environment.apiUrl}/empresa`).subscribe({
      next: (e) => this.empresaSignal.set(e),
      error: () => this.empresaSignal.set(null)
    });
  }
}
