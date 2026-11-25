/*
 * Para qué sirve: Guarda, lee y borra la sesión en localStorage.
 * PATRÓN Facade: el objeto almacen esconde localStorage y el formato JSON de la sesión.
 */
import type { Rol } from '../api/tipos'

export interface Sesion {
  token: string
  usuario: string
  rol: Rol
  nombre: string
  expiraEn: number
}

const LLAVE = 'taller.sesion'

/**
 * La sesion se guarda en localStorage.
 *
 * Una cookie httpOnly seria mas resistente a XSS, pero exige que el backend
 * maneje cookies y proteccion CSRF. Queda anotado como mejora pendiente; el
 * token dura ocho horas y se borra al primer 401.
 */
export const almacen = {
  leer(): Sesion | null {
    const crudo = localStorage.getItem(LLAVE)
    if (!crudo) return null
    try {
      const s = JSON.parse(crudo) as Sesion
      if (s.expiraEn && s.expiraEn < Date.now()) {
        localStorage.removeItem(LLAVE)
        return null
      }
      return s
    } catch {
      localStorage.removeItem(LLAVE)
      return null
    }
  },

  guardar(s: Sesion) {
    localStorage.setItem(LLAVE, JSON.stringify(s))
  },

  borrar() {
    localStorage.removeItem(LLAVE)
  },
}

/** Permite que la capa de API lea el token sin importar el contexto de React. */
export const tokenActual = () => almacen.leer()?.token ?? null
