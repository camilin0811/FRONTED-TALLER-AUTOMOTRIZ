import type { EstadoCompra, EstadoOrden, Rol } from './api/tipos'

/**
 * Nombre para personas de cada estado de la orden.
 *
 * Es el único lugar donde un estado se convierte en texto: la línea de
 * tiempo, las insignias, los filtros y los mensajes lo toman de aquí. El
 * tipo Record obliga a que, si el backend suma un estado, el compilador
 * pida su etiqueta en lugar de mostrar el identificador crudo.
 */
export const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  RECIBIDA: 'Recibida',
  EN_DIAGNOSTICO: 'En diagnóstico',
  COTIZADA: 'Cotizada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  EN_REPARACION: 'En reparación',
  EN_ESPERA_REPUESTO: 'En espera de repuesto',
  CERRADA: 'Cerrada',
  FACTURADA: 'Facturada',
  ENTREGADA: 'Entregada',
}

/** Nombre para personas de cada rol (el menú y los avisos de acceso lo muestran). */
export const ETIQUETA_ROL: Record<Rol, string> = {
  CLIENTE: 'Cliente',
  MECANICO: 'Mecánico',
  RECEPCIONISTA: 'Recepcionista',
  ADMINISTRADOR: 'Administrador',
}

/** Estados de la cotizacion que acompana a una orden. */
export const ETIQUETA_COTIZACION: Record<string, string> = {
  EMITIDA: 'pendiente de respuesta del cliente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
  VENCIDA: 'vencida',
}

export const ETIQUETA_COMPRA: Record<EstadoCompra, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  RECIBIDA_PARCIAL: 'Recibida en parte',
  RECIBIDA: 'Recibida',
  ANULADA: 'Anulada',
}

export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
}

/**
 * Que significa "activa" en el tablero: el vehiculo esta en trabajo.
 * Las cerradas, facturadas y rechazadas ya no se trabajan, pero el vehiculo
 * sigue en el taller hasta entregarlo: son "por entregar".
 */
export const EN_PROCESO: EstadoOrden[] = [
  'RECIBIDA', 'EN_DIAGNOSTICO', 'COTIZADA', 'APROBADA', 'EN_REPARACION', 'EN_ESPERA_REPUESTO',
]
export const POR_ENTREGAR: EstadoOrden[] = ['CERRADA', 'FACTURADA', 'RECHAZADA']

/** Etiqueta de un estado; si llega uno desconocido, al menos sin guiones bajos. */
export function etiquetaEstado(estado: string): string {
  return ETIQUETA_ESTADO[estado as EstadoOrden]
    ?? estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' ')
}
