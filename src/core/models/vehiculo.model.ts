import { Combustible, EstadoVehiculoCatalogo, Modelo, TipoVehiculo } from './catalogo.model';

export interface VehiculoUnidad {
  idUnidad?: number;
  idModelo?: number;
  placa: string;
  color?: string;
  numeroVin?: string;
  numeroMotor?: string;
  // Odómetro de la unidad y su control de mantenimiento
  kilometraje?: number;
  kmProximoMantenimiento?: number;
  kmRestantesMantenimiento?: number;
  kmIntervaloMantenimiento?: number;
  // Si está alquilada ahora: a quién y qué contrato
  alquiladaA?: string | null;
  // Agenda de la placa: su próxima reserva aprobada y si el recojo está cerca (unidad comprometida)
  proximaReserva?: string | null;
  idProximaReserva?: number | null;
  reservaProximaBloquea?: boolean | null;
  reemplazoDisponible?: boolean | null;
  idAlquilerActual?: number | null;
  sede?: string;
  estado?: EstadoVehiculoCatalogo;
}

export interface VehiculoModelo {
  idModelo: number;
  idVehiculo?: number;
  marca: any;
  nombreModelo: string;
  anio: number;
  tipoCarroceria?: string;
  tipo?: any;
  combustible?: any;
  precioDia: number;
  precioHora: number;
  garantia?: number;
  // Cada cuántos km cada unidad del modelo debe pasar por mantenimiento
  kmMantenimiento?: number;
  activo?: boolean;
  sede?: string;
  imagenUrl?: string;
  imagenes?: ImagenVehiculo[];
  unidades?: VehiculoUnidad[];
  unidadesTotales?: number;
  unidadesDisponibles?: number;
}

export interface Vehiculo {
  idVehiculo?: number;
  idModelo?: number;
  placa?: string;
  color?: string;
  anio: number;
  numeroMotor?: string;
  numeroVin?: string;
  precioDia: number;
  precioHora: number;
  imagenUrl?: string;
  sede?: string;
  kmMantenimiento?: number;
  imagenes?: ImagenVehiculo[];
  modelo?: Modelo | any;
  nombreModelo?: string;
  marca?: any;
  tipo?: TipoVehiculo | any;
  tipoCarroceria?: string;
  combustible?: Combustible | any;
  estado?: EstadoVehiculoCatalogo;
  activo?: boolean;
  unidadesTotales?: number;
  unidadesDisponibles?: number;
  unidades?: VehiculoUnidad[];
}

export interface ImagenVehiculo {
  idImagen?: number;
  urlImagen: string;
  orden: number;
}
