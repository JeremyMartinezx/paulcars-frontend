export interface Marca {
  idMarca: number;
  nombreMarca: string;
}

export interface Modelo {
  idModelo: number;
  modelo: string;
  marca: Marca;
}

export interface TipoVehiculo {
  idTipo: number;
  nombreTipo: string;
}

export interface Combustible {
  idCombustible: number;
  nombreCombustible: string;
}

export interface EstadoVehiculoCatalogo {
  idEstado: number;
  nombreEstado: string;
}

export interface Catalogos {
  marcas: Marca[];
  modelos: Modelo[];
  tiposVehiculo: TipoVehiculo[];
  combustibles: Combustible[];
  estadosVehiculo: EstadoVehiculoCatalogo[];
}