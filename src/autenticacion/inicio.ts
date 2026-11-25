/*
 * Para qué sirve: Indica la pantalla de inicio de cada rol.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import type { Rol } from '../api/tipos'

/**
 * Pantalla de inicio de cada rol: a donde lleva "Volver al tablero".
 * El mecanico no tiene acceso al tablero de recepcion; su inicio es su
 * propia lista de trabajo.
 */
export function inicioDe(rol: Rol | undefined): string {
  return rol === 'MECANICO' ? '/mecanico' : '/recepcion'
}
