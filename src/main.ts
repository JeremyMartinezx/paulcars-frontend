import { bootstrapApplication } from '@angular/platform-browser';
import { enableProdMode } from '@angular/core';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
  // Blindaje DevSecOps: Supresión de trazas de consola en producción
  // para evitar la inspección de payloads, tokens y arquitectura interna en DevTools
  window.console.log = () => {};
  window.console.info = () => {};
  window.console.debug = () => {};
  window.console.trace = () => {};
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
