import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../../core/service/auth.service';

@Component({
  selector: 'app-back-button',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <a mat-stroked-button [routerLink]="panelUrl()" class="back-button">
      <mat-icon>arrow_back</mat-icon>
      Volver al panel
    </a>
  `,
  styleUrl: './back-button.component.css'
})
export class BackButtonComponent {
  private readonly authService = inject(AuthService);

  readonly panelUrl = computed(() =>
    this.authService.rolActual() === 'ADMIN' ? '/admin' : '/empleado'
  );
}