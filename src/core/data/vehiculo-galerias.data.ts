import { Vehiculo } from '../models/vehiculo.model';
import { resolverUrlImagen } from '../utils/imagen-url.util';

// Etiquetas de la galería de 4 fotos cargada desde el panel admin
const LABELS_GALERIA_ADMIN = ['Frontal 3/4', 'Lateral', 'Posterior', 'Habitáculo / Interior'];

export interface GaleriaFoto {
  url: string;
  label: string;
}

const GALERIAS_CATALOGO: Record<string, string[]> = {
  'corolla': [
    '/images/vehiculos/corolla.jpg',
    '/images/vehiculos/corolla_side.jpg',
    '/images/vehiculos/corolla_rear.jpg',
    '/images/vehiculos/corolla_interior.jpg'
  ],
  'hilux': [
    '/images/vehiculos/hilux.jpg',
    '/images/vehiculos/hilux_side.jpg',
    '/images/vehiculos/hilux_rear.jpg',
    '/images/vehiculos/hilux_interior.jpg'
  ],
  'tucson': [
    '/images/vehiculos/tucson.jpg',
    '/images/vehiculos/tucson_side.jpg',
    '/images/vehiculos/tucson_rear.jpg',
    '/images/vehiculos/tucson_interior.jpg'
  ],
  'kicks': [
    '/images/vehiculos/kicks.jpg',
    '/images/vehiculos/kicks_side.jpg',
    '/images/vehiculos/kicks_rear.jpg',
    '/images/vehiculos/kicks_interior.jpg'
  ],
  'rio': [
    '/images/vehiculos/rio.jpg',
    '/images/vehiculos/rio_side.jpg',
    '/images/vehiculos/rio_rear.jpg',
    '/images/vehiculos/rio_interior.jpg'
  ],
  'l200': [
    '/images/vehiculos/l200.jpg',
    '/images/vehiculos/l200_side.jpg',
    '/images/vehiculos/l200_rear.jpg',
    '/images/vehiculos/l200_interior.jpg'
  ],
  'ranger': [
    '/images/vehiculos/ranger.jpg',
    '/images/vehiculos/ranger_side.jpg',
    '/images/vehiculos/ranger_rear.jpg',
    '/images/vehiculos/ranger_interior.jpg'
  ],
  'swift': [
    '/images/vehiculos/swift.jpg',
    '/images/vehiculos/swift_side.jpg',
    '/images/vehiculos/swift_rear.jpg',
    '/images/vehiculos/swift_interior.jpg'
  ],
  "kia-grand-carnival": [
      "https://rentalcarperu.com/assets/kia-grand-carnival-uisDHdyF.webp",
      "https://rentalcarperu.com/assets/kia-carnival-1-CazY8gpZ.webp",
      "https://rentalcarperu.com/assets/kia-carnival-2-DZiQnrVz.webp",
      "https://rentalcarperu.com/assets/kia-carnival-3-DGoZT9UZ.webp",
      "https://rentalcarperu.com/assets/kia-carnival-9-DxE2l1Q7.webp",
      "https://rentalcarperu.com/assets/kia-carnival-10-CF26S8O8.webp",
      "https://rentalcarperu.com/assets/kia-carnival-11-CwVeYrrZ.webp",
      "https://rentalcarperu.com/assets/kia-carnival-4-ChkdGSt9.webp",
      "https://rentalcarperu.com/assets/kia-carnival-5-BWQaV9Pj.webp",
      "https://rentalcarperu.com/assets/kia-carnival-6-BlrMLmFu.webp",
      "https://rentalcarperu.com/assets/kia-carnival-7-CUqoE-2t.webp",
      "https://rentalcarperu.com/assets/kia-carnival-8-CD5BDng4.webp"
  ],

  "mitsubishi-asx": [
      "/images/vehiculos/asx.jpg",
      "/images/vehiculos/asx_side.jpg",
      "/images/vehiculos/asx_rear.jpg",
      "/images/vehiculos/asx_interior.jpg"
  ],
  "ford-territory": [
      "https://rentalcarperu.com/assets/ford-territory-hAgILSf1.webp",
      "https://rentalcarperu.com/assets/ford-territory-1-u_Wy2zV2.webp",
      "https://rentalcarperu.com/assets/ford-territory-2-BVTe9Xz8.webp",
      "https://rentalcarperu.com/assets/ford-territory-3-DXL8GSTA.webp",
      "https://rentalcarperu.com/assets/ford-territory-4-Bla4usat.webp",
      "https://rentalcarperu.com/assets/ford-territory-5-Bqv1DNBg.webp",
      "https://rentalcarperu.com/assets/ford-territory-6-BbdS9_bW.webp",
      "https://rentalcarperu.com/assets/ford-territory-7--RDYCfOx.webp",
      "https://rentalcarperu.com/assets/ford-territory-8-Bi5Bgf0m.webp",
      "https://rentalcarperu.com/assets/ford-territory-9-DW_YaaAi.webp",
      "https://rentalcarperu.com/assets/ford-territory-10-Bd_zbzjT.webp"
  ],
  "jac-refine": [
      "https://rentalcarperu.com/assets/jac-refine-DsvWdeKd.webp",
      "https://rentalcarperu.com/assets/jac-refine-1-CGIIw6oK.webp",
      "https://rentalcarperu.com/assets/jac-refine-2-oUP64xkX.webp",
      "https://rentalcarperu.com/assets/jac-refine-3-BYrGShHT.webp",
      "https://rentalcarperu.com/assets/jac-refine-4-DgGtvs_V.webp",
      "https://rentalcarperu.com/assets/jac-refine-5-DmoCr2cO.webp",
      "https://rentalcarperu.com/assets/jac-refine-6-jSi1N2Ep.webp",
      "https://rentalcarperu.com/assets/jac-refine-7-DUaYzpMh.webp",
      "https://rentalcarperu.com/assets/jac-refine-8-ZBtsW7ET.webp",
      "https://rentalcarperu.com/assets/jac-refine-9-BQL3f8IZ.webp",
      "https://rentalcarperu.com/assets/jac-refine-10-DS3b9kg9.webp"
  ],

  "mazda-3": [
      "/images/vehiculos/mazda3.jpg",
      "/images/vehiculos/mazda3_side.jpg",
      "/images/vehiculos/mazda3_rear.jpg",
      "/images/vehiculos/mazda3_interior.jpg"
  ],
  "toyota-corolla-hybrido": [
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-CgGdtY0Z.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-1-CrfOxMLl.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-2-BxN86KVd.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-3--F3MTzAm.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-4-DqjxtQbq.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-5-h4DusGwI.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-6-Dutzb9g5.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-7-DYT7h4SS.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-8-DlQGYKqW.webp",
      "https://rentalcarperu.com/assets/toyota-corolla-hybrido-9-Cojz2CPx.webp"
  ],
  "chevrolet-n400": [
      "https://rentalcarperu.com/assets/chevrolet-n400-Ivz21qok.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-1-DU5SUO4l.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-2-Dt-Fek4I.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-3-B6qYR0SY.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-4-wiP_q8dE.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-5-BWyBGYR4.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-6-kBmwOCFz.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-7-DhRbaNK3.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-8-DVKYcPsQ.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-9-CtJeffrq.webp",
      "https://rentalcarperu.com/assets/chevrolet-n400-10-BVTBczRo.webp"
  ],

  "nissan-versa": [
      "/images/vehiculos/versa.jpg",
      "/images/vehiculos/versa_side.jpg",
      "/images/vehiculos/versa_rear.jpg",
      "/images/vehiculos/versa_interior.jpg"
  ],
  "kia-sorento": [
      "https://rentalcarperu.com/assets/kia-sorento-B7F2uApm.webp",
      "https://rentalcarperu.com/assets/kia-sorento-1-BpqVMVx7.webp",
      "https://rentalcarperu.com/assets/kia-sorento-2-BS6Jhtyr.webp",
      "https://rentalcarperu.com/assets/kia-sorento-3-BlsybEfR.webp",
      "https://rentalcarperu.com/assets/kia-sorento-4-m-jimULI.webp",
      "https://rentalcarperu.com/assets/kia-sorento-5-BA9x9MbG.webp",
      "https://rentalcarperu.com/assets/kia-sorento-6-q972VaC1.webp",
      "https://rentalcarperu.com/assets/kia-sorento-7-CBGUS3Gb.webp",
      "https://rentalcarperu.com/assets/kia-sorento-8-ZOSu2xaQ.webp",
      "https://rentalcarperu.com/assets/kia-sorento-9-DXOsBfiu.webp",
      "https://rentalcarperu.com/assets/kia-sorento-10-DLgQm1oq.webp"
  ],
  "toyota-avanza": [
      "https://rentalcarperu.com/assets/toyota-avanza-VCqse6oG.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-1-vPvhKzxQ.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-2-awrfs2zU.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-3-BVr3kjEP.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-4-DSYZ3j25.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-5-BnvrdowH.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-6-DljUQMHN.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-7-D4M0_6AY.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-8-NDrpVTwz.webp",
      "https://rentalcarperu.com/assets/toyota-avanza-9-BxApccAJ.webp"
  ],
  "kia-sonet": [
      "https://rentalcarperu.com/assets/kia-sonet-CVb3gOkr.webp",
      "https://rentalcarperu.com/assets/kia-sonet-1-ELZUNYg2.webp",
      "https://rentalcarperu.com/assets/kia-sonet-2-CdpPu6ED.webp",
      "https://rentalcarperu.com/assets/kia-sonet-3-wXKrZEha.webp",
      "https://rentalcarperu.com/assets/kia-sonet-4-C7nlLXdt.webp",
      "https://rentalcarperu.com/assets/kia-sonet-5-Bw2B_oaB.webp",
      "https://rentalcarperu.com/assets/kia-sonet-6-DnQF7uq3.webp",
      "https://rentalcarperu.com/assets/kia-sonet-7-C4Z7EBze.webp",
      "https://rentalcarperu.com/assets/kia-sonet-8-X2FZT47x.webp",
      "https://rentalcarperu.com/assets/kia-sonet-9-0ChsjYZp.webp"
  ],
  "chevrolet-traverse": [
      "https://rentalcarperu.com/assets/chevrolet-traverse-IKVd_69t.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-1-5-8U4VvG.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-2-RqTqePKd.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-3-ew2nTf2O.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-4-CTlnI1pz.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-5-BrLIwpKN.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-6-CmiTxGmZ.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-7-D8DoJWB9.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-8-Bmmxo1UL.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-9-4ZozUKPU.webp",
      "https://rentalcarperu.com/assets/chevrolet-traverse-10-yPHAKAFA.webp"
  ],
  "mazda-cx5": [
      "https://rentalcarperu.com/assets/mazda-cx5-CVPsNU43.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-1-DcmxFKim.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-2-CmJvk_5h.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-3-Dgd357-8.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-4-5aMlOsBB.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-5-Bmw-N9e3.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-6-CZ2CLBQD.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-7-BFEWThAB.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-8-C-VNgQOM.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-9-CyulIass.webp",
      "https://rentalcarperu.com/assets/mazda-cx5-10-DbbsylNk.webp"
  ],
  "hyundai-staria": [
      "https://rentalcarperu.com/assets/hyundai-staria-BEOxKG2k.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-1-DCq66yE-.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-2-C093nz11.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-3-EENJR54t.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-4-lNYPkAxr.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-5-DTz-2cnW.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-6-DZBnAwI6.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-7-DDwaa27p.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-8-47mh7-WX.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-9-CSQ4vwlx.webp",
      "https://rentalcarperu.com/assets/hyundai-staria-10-3cFy-qkr.webp"
  ],
};

const LABELS_DEFAULT = [
  'Vista frontal principal',
  'Perfil lateral dinámico',
  'Vista posterior y maletero',
  'Cabina interior y confort',
  'Tablero y sistema multimedia',
  'Segunda fila de asientos',
  'Detalle y acabados',
  'Espacio de carga y tolva',
  'Ángulo posterior tres cuartos',
  'Detalle frontal y óptica LED',
  'Interior panorámico'
];

export function obtenerGaleriaVehiculo(vehiculo: Vehiculo | null | undefined): GaleriaFoto[] {
  if (!vehiculo) return [];

  // 1) Si el administrador cargó fotos, esas mandan (ordenadas de 1 a 4)
  const propias = [...(vehiculo.imagenes ?? [])]
    .filter((img) => !!img?.urlImagen)
    .sort((a, b) => a.orden - b.orden);
  if (propias.length > 0) {
    return propias.map((img) => ({
      url: resolverUrlImagen(img.urlImagen),
      label: LABELS_GALERIA_ADMIN[img.orden - 1] || 'Fotografía del vehículo'
    }));
  }

  const mod = (vehiculo.modelo?.modelo || '').toLowerCase().trim();
  const marca = (vehiculo.modelo?.marca?.nombreMarca || '').toLowerCase().trim();
  const placa = (vehiculo.placa || '').toUpperCase().trim();
  const mainImg = vehiculo.imagenUrl || '';

  let urls: string[] = [];

  if (mod.includes('hilux') || placa === 'GHI-789' || placa === 'TOY-503') {
    urls = GALERIAS_CATALOGO['hilux'];
  } else if (mod.includes('tucson') || placa === 'DEF-456') {
    urls = GALERIAS_CATALOGO['tucson'];
  } else if (mod.includes('kicks') || placa === 'MNO-345') {
    urls = GALERIAS_CATALOGO['kicks'];
  } else if (mod.includes('rio') || placa === 'JKL-012') {
    urls = GALERIAS_CATALOGO['rio'];
  } else if (mod.includes('ranger') || placa === 'FRD-601') {
    urls = GALERIAS_CATALOGO['ranger'];
  } else if (mod.includes('l200') || placa === 'MIT-103') {
    urls = GALERIAS_CATALOGO['l200'];
  } else if (mod.includes('swift') || placa === 'SZK-701') {
    urls = GALERIAS_CATALOGO['swift'];
  } else if (mod.includes('corolla') || placa === 'ABC-123') {
    urls = GALERIAS_CATALOGO['corolla'];
  } else if (mod.includes('versa') || placa === 'NSS-201') {
    urls = GALERIAS_CATALOGO['nissan-versa'];
  } else if (mod.includes('asx') || placa === 'MIT-102') {
    urls = GALERIAS_CATALOGO['mitsubishi-asx'];
  } else if (mod.includes('mazda 3') || (marca.includes('mazda') && (mod === '3' || mod.includes('3'))) || placa === 'MZD-401' || placa === 'KIA-401') {
    urls = GALERIAS_CATALOGO['mazda-3'];
  } else if (mod.includes('sonet') || placa === 'KIA-403' || placa === 'NSS-203') {
    urls = GALERIAS_CATALOGO['kia-sonet'];
  } else if (mod.includes('sorento')) {
    urls = GALERIAS_CATALOGO['kia-sorento'];
  } else if (mod.includes('territory')) {
    urls = GALERIAS_CATALOGO['ford-territory'];
  } else if (mod.includes('cx5') || mod.includes('cx-5')) {
    urls = GALERIAS_CATALOGO['mazda-cx5'];
  }

  if (!urls || urls.length === 0) {
    if (mainImg) {
      urls = [mainImg];
    } else {
      urls = ['/images/vehiculos/corolla.jpg'];
    }
  }

  if (mainImg && !urls.includes(mainImg) && urls.length < 4) {
    urls = [mainImg, ...urls];
  }

  return urls.map((url, idx) => ({
    url: resolverUrlImagen(url),
    label: LABELS_DEFAULT[idx] || ('Fotografía ' + (idx + 1) + ' del vehículo')
  }));
}

export function obtenerImagenVehiculo(vehiculo: Vehiculo | null | undefined): string {
  if (!vehiculo) return '';
  const principal = (vehiculo.imagenes ?? []).find((img) => img.orden === 1);
  if (principal?.urlImagen) {
    return resolverUrlImagen(principal.urlImagen);
  }
  if (vehiculo.imagenUrl && vehiculo.imagenUrl.trim().length > 0) {
    return resolverUrlImagen(vehiculo.imagenUrl);
  }
  const galeria = obtenerGaleriaVehiculo(vehiculo);
  return galeria[0]?.url || '/images/vehiculos/corolla.jpg';
}
