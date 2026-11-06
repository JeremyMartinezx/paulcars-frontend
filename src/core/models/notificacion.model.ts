export type TipoNotificacionApi =
  | 'NUEVA_RESERVA'
  | 'RECORDATORIO_DEVOLUCION'
  | 'DEVOLUCION_1H'
  | 'DEVOLUCION_2H'
  | 'DEVOLUCION_VENCIDA'
  | 'DEVOLUCION_HOY'
  | 'ALQUILER_EN_CURSO'
  | 'RECOJO_HOY'
  | 'RESERVA_APROBADA'
  | 'ALQUILER_FINALIZADO'
  | 'CERRADO_CON_DEUDA'
  | 'SOLICITUD_RECHAZADA'
  | 'SOLICITUD_PENDIENTE'
  | string;

export interface NotificacionApi {
  clave: string;
  tipo: TipoNotificacionApi;
  titulo: string;
  mensaje: string;
  fecha: string;
  idAlquiler: number;
  leida: boolean;
}
