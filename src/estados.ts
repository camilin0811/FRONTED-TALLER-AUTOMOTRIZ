import type { EstadoOrden, Rol } from './api/tipos'

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

/** Etiqueta de un estado; si llega uno desconocido, al menos sin guiones bajos. */
export function etiquetaEstado(estado: string): string {
  return ETIQUETA_ESTADO[estado as EstadoOrden]
    ?? estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' ')
}
