export interface Cliente {
  idCliente?: number;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  email: string;
  licenciaConducir: string;
  direccion?: string;
  password?: string;
  passwordPersonalizado?: boolean;
  estadoCliente?: 'ACTIVO' | 'LISTA_NEGRA' | string;
}