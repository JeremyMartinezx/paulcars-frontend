import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, Subscription } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { descargarBlob } from '../../../core/utils/descarga.util';

/** Un documento más dentro del mismo visor (por ejemplo, la boleta y el acta de un alquiler finalizado). */
export interface VisorPdfDocumento {
  /** Texto corto de la pestaña. */
  etiqueta: string;
  titulo: string;
  subtitulo?: string;
  pdf$: Observable<Blob>;
  nombreArchivo: string;
}

export interface VisorPdfData {
  titulo: string;
  subtitulo?: string;
  /** Observable que entrega el PDF (se descarga al abrir el visor). */
  pdf$: Observable<Blob>;
  nombreArchivo: string;
  /** Aviso opcional bajo el visor, por ejemplo "Recibo enviado a cliente@correo.com". */
  aviso?: string;
  /** Si hay varios documentos, el visor muestra pestañas para pasar de uno a otro. */
  documentos?: VisorPdfDocumento[];
}

// Visor de PDF en pantalla: muestra el documento al instante y permite descargarlo
@Component({
  selector: 'app-visor-pdf-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './visor-pdf-dialog.component.html',
  styleUrl: './visor-pdf-dialog.component.css'
})
export class VisorPdfDialogComponent implements OnInit, OnDestroy {
  readonly data = inject<VisorPdfData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VisorPdfDialogComponent>);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('visor') visor?: ElementRef<HTMLIFrameElement>;

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly url = signal<SafeResourceUrl | null>(null);
  readonly seleccionado = signal(0);

  private blob: Blob | null = null;
  private urlObjeto: string | null = null;
  private suscripcion: Subscription | null = null;

  get documentos(): VisorPdfDocumento[] {
    return this.data.documentos ?? [];
  }

  get actual(): { titulo: string; subtitulo?: string; nombreArchivo: string } {
    return this.documentos.length ? this.documentos[this.seleccionado()] : this.data;
  }

  ngOnInit(): void {
    this.cargar(this.documentos.length ? this.documentos[0].pdf$ : this.data.pdf$);
  }

  elegir(indice: number): void {
    if (indice === this.seleccionado()) return;
    this.seleccionado.set(indice);
    this.cargar(this.documentos[indice].pdf$);
  }

  private cargar(pdf$: Observable<Blob>): void {
    this.suscripcion?.unsubscribe();
    if (this.urlObjeto) URL.revokeObjectURL(this.urlObjeto);
    this.urlObjeto = null;
    this.blob = null;
    this.url.set(null);
    this.error.set(false);
    this.cargando.set(true);
    this.suscripcion = pdf$.subscribe({
      next: (blob) => {
        this.blob = new Blob([blob], { type: 'application/pdf' });
        this.urlObjeto = URL.createObjectURL(this.blob);
        this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.urlObjeto));
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
    if (this.urlObjeto) URL.revokeObjectURL(this.urlObjeto);
  }

  descargar(): void {
    if (this.blob) descargarBlob(this.blob, this.actual.nombreArchivo);
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
