import { createContext, useCallback, useContext } from 'react'
import { ErrorApi } from '../api/cliente'

export type TonoToast = 'exito' | 'error'

export interface OpcionesConfirmacion {
  titulo: string
  /** Que va a pasar, en palabras del usuario. */
  mensaje: React.ReactNode
  /** Texto del boton que ejecuta: un verbo concreto, no "Aceptar". */
  confirmar: string
  /** Acciones que no se pueden deshacer o que rechazan algo. */
  peligro?: boolean
}

/** Opciones de una accion confirmada. */
export interface OpcionesAccion extends OpcionesConfirmacion {
  exito: string
  /**
   * Se llama solo cuando el usuario confirma, justo antes de ejecutar: es
   * el momento de mostrar "Creando…" o deshabilitar botones. Si cancela,
   * no se llama y la pantalla no cambia.
   */
  alConfirmar?: () => void
}

export interface ContextoInteraccion {
  notificar: (tono: TonoToast, mensaje: string) => void
  confirmar: (opciones: OpcionesConfirmacion) => Promise<boolean>
}

export const Contexto = createContext<ContextoInteraccion | null>(null)

function useContextoInteraccion(): ContextoInteraccion {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('Falta <ProveedorInteraccion> en el árbol de componentes')
  return ctx
}

export function useNotificar() {
  return useContextoInteraccion().notificar
}

export function useConfirmar() {
  return useContextoInteraccion().confirmar
}

/** Mensaje legible de cualquier error, incluidos los de validacion por campo. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ErrorApi) {
    const campos = Object.values(e.erroresDeCampo)
    return campos.length > 0 ? campos.join('. ') : e.message
  }
  return 'Ocurrió un error inesperado. Intente de nuevo.'
}

/**
 * Patron comun de toda accion que cambia datos: pedir confirmacion en un
 * modal propio, ejecutar, y avisar con un toast de exito o de error.
 *
 * Devuelve el resultado, o undefined si el usuario cancelo o fallo.
 */
export function useAccionConfirmada() {
  const { confirmar, notificar } = useContextoInteraccion()
  return useCallback(async <T,>(
    opciones: OpcionesAccion,
    accion: () => Promise<T>,
    alFallar?: (e: unknown) => void,
  ): Promise<T | undefined> => {
    if (!(await confirmar(opciones))) return undefined
    opciones.alConfirmar?.()
    try {
      const resultado = await accion()
      notificar('exito', opciones.exito)
      return resultado
    } catch (e) {
      notificar('error', mensajeDeError(e))
      alFallar?.(e)
      return undefined
    }
  }, [confirmar, notificar])
}
