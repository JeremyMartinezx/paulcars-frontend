import { environment } from '../../environments/environment';

const MAPA_IMAGENES_LOCALES: Record<string, string> = {
  'https://rentalcarperu.com/assets/nissan-versa-2-CKNEMnlU.webp': '/images/vehiculos/versa.jpg',
  'https://rentalcarperu.com/assets/nissan-versa-3-BTyc7h-X.webp': '/images/vehiculos/versa_side.jpg',
  'https://rentalcarperu.com/assets/nissan-versa-5-10pvbM9S.webp': '/images/vehiculos/versa_rear.jpg',
  'https://rentalcarperu.com/assets/mazda-3-1-DUDeIqJS.webp': '/images/vehiculos/mazda3.jpg',
  'https://rentalcarperu.com/assets/mazda-3-2-DR86lc1Y.webp': '/images/vehiculos/mazda3_side.jpg',
  'https://rentalcarperu.com/assets/mazda-3-3-Cy7gfVBv.webp': '/images/vehiculos/mazda3_rear.jpg',
  'https://rentalcarperu.com/assets/mazda-3-6-4N_lBlBT.webp': '/images/vehiculos/mazda3_interior.jpg',
  'https://rentalcarperu.com/assets/mitsubishi-asx-1-NALyis9T.webp': '/images/vehiculos/asx.jpg',
  'https://rentalcarperu.com/assets/mitsubishi-asx-2-BOGdtseC.webp': '/images/vehiculos/asx_side.jpg',
  'https://rentalcarperu.com/assets/mitsubishi-asx-4-CrYsB8wt.webp': '/images/vehiculos/asx_rear.jpg',
  'https://rentalcarperu.com/assets/mitsubishi-asx-5-B_6zRXAi.webp': '/images/vehiculos/asx_interior.jpg',
};

const ASSET_VERSION = 'v=pc2';

// Las fotos subidas por el admin viven en el backend (/uploads/...).
// Las del catálogo inicial viven en el frontend (/images/...) o en internet (https://...).
// Esta función arma la URL correcta para el <img>.
export function resolverUrlImagen(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  const mapped = MAPA_IMAGENES_LOCALES[trimmed] || trimmed;

  if (mapped.startsWith('/uploads/')) {
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    return base + mapped;
  }
  if (mapped.startsWith('/images/vehiculos/')) {
    const baseImg = mapped.split('?')[0];
    return `${baseImg}?${ASSET_VERSION}`;
  }
  return mapped;
}
