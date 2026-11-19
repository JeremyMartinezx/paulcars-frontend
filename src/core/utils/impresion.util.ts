// Impresión de un bloque concreto de la página (sin menú, filtros ni botones).
// Se copia el bloque a un iframe oculto con los mismos estilos y se imprime solo ese documento.

export interface OpcionesImpresion {
  titulo: string;
  orientacion?: 'landscape' | 'portrait';
}

export async function imprimirElemento(elemento: HTMLElement, opciones: OpcionesImpresion): Promise<void> {
  const orientacion = opciones.orientacion ?? 'portrait';
  // La tipografía de la aplicación se define en el body: se copia para que el reporte impreso se vea igual
  const fuente = getComputedStyle(document.body).fontFamily;

  // Estilos de la aplicación (globales y de cada componente) para que el bloque se vea igual
  const estilos = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((nodo) => {
      if (nodo instanceof HTMLLinkElement) {
        return `<link rel="stylesheet" href="${nodo.href}">`;
      }
      return nodo.outerHTML;
    })
    .join('\n');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const ventana = iframe.contentWindow;
  if (!doc || !ventana) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <base href="${document.baseURI}">
  <title>${opciones.titulo}</title>
  ${estilos}
  <style>
    @page { size: A4 ${orientacion}; margin: 10mm; }
    html, body { margin: 0; padding: 0; background: #fff !important; }
    body { font-family: ${fuente}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body class="${document.body.className} vista-impresion">${elemento.outerHTML}</body>
</html>`);
  doc.close();

  // Se espera a que carguen las imágenes (logo) y las hojas de estilo antes de imprimir
  const imagenes = Array.from(doc.images).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(imagenes.map((img) => new Promise<void>((ok) => { img.onload = () => ok(); img.onerror = () => ok(); }))),
    new Promise<void>((ok) => setTimeout(ok, 4000))
  ]);
  await new Promise<void>((ok) => setTimeout(ok, 250));

  const limpiar = () => setTimeout(() => iframe.remove(), 500);
  ventana.addEventListener('afterprint', limpiar);
  ventana.focus();
  ventana.print();
  // Respaldo por si el navegador no dispara afterprint
  setTimeout(() => iframe.remove(), 120_000);
}
