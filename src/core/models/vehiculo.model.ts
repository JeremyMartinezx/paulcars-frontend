import { Combustible, EstadoVehiculoCatalogo, Modelo, TipoVehiculo } from './catalogo.model';

export interface VehiculoUnidad {
  idUnidad?: number;
  idModelo?: number;
  placa: string;
  color?: string;
  numeroVin?: string;
  numeroMotor?: string;
  kilometraje?: number;
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
  kilometraje?: number | null;
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
