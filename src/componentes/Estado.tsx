/*
 * Para qué sirve: Insignia con color y texto del estado de la orden.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import type { EstadoOrden } from '../api/tipos'
import { etiquetaEstado } from '../estados'

/**
 * Insignia de estado.
 *
 * El texto siempre acompana al color. Un usuario con daltonismo no puede
 * depender del verde para saber en que va su vehiculo (criterio de
 * accesibilidad de la pagina de mockups).
 */
const TONO: Record<EstadoOrden, string> = {
  RECIBIDA: 'gris',
  EN_DIAGNOSTICO: 'gris',
  COTIZADA: 'ambar',
  APROBADA: 'gris',
  RECHAZADA: 'rojo',
  EN_REPARACION: 'verde',
  EN_ESPERA_REPUESTO: 'rojo',
  CERRADA: 'gris',
  FACTURADA: 'verde',
  ENTREGADA: 'verde',
}

export function Estado({ valor }: { valor: EstadoOrden }) {
  return <span className={`estado ${TONO[valor] ?? 'gris'}`}>{etiquetaEstado(valor)}</span>
}
