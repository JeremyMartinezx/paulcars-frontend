import { Alquiler } from './alquiler.model';

export interface MetodoPagoCatalogo {
  idMetodoPago: number;
  nombreMetodo: string;
}

export interface Pago {
  idPago?: number;
  alquiler: Alquiler;
  metodoPago: MetodoPagoCatalogo;
  montoTotal: number;
  fechaPago: string;
  estadoPago: string;
  tipoPago?: 'ALQUILER' | 'LIQUIDACION' | string | null;
  montoRecibido?: number | null;
  vuelto?: number | null;
  ultimosDigitos?: string | null;
  numeroOperacion?: string | null;
  bancoOrigen?: string | null;
  canal?: 'DIGITAL' | 'COUNTER' | string | null;
  validadoPor?: string | null;
  fechaValidacion?: string | null;
}

// Body de POST /api/pagos (cobro presencial en counter)
export interface RegistrarPagoRequest {
  idAlquiler: number;
  idMetodoPago: number;
  monto: number;
  montoRecibido?: number | null;
  ultimosDigitos?: string | null;
  numeroOperacion?: string | null;
  bancoOrigen?: string | null;
  garantiaConfirmada?: boolean;
}

// Modelos transaccionales para Yape, Plin y Tarjeta Digital
export interface YapePagoRequest {
  idAlquiler: number;
  celular: string;
  otp: string;
  monto: number;
}

export interface PlinPagoRequest {
  idAlquiler: number;
  celular?: string;
  banco: string;
  monto: number;
}

export interface TarjetaPagoRequest {
  idAlquiler: number;
  token?: string;
  marca?: string;
  ultimosCuatroDigitos?: string;
  titular?: string;
  monto?: number;
  numeroTarjeta?: string;
  vencimiento?: string;
  cvv?: string;
}

export interface TransaccionPagoResponse {
  status: string;
  transactionId: string;
  message: string;
  metodo: string;
  monto: number;
  fecha: string;
  idAlquiler: number;
  nuevoEstado: string;
}
