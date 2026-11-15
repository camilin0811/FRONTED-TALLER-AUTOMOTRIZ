import type { CuerpoError } from './tipos'
import { tokenActual } from '../autenticacion/sesion'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

/**
 * Error de la API con el codigo estable que define el backend.
 *
 * Se conserva `codigo` separado de `mensaje` a proposito: la interfaz decide
 * que hacer segun el codigo, y muestra el mensaje tal cual lo escribio el
 * backend, que ya viene redactado para una persona.
 */
export class ErrorApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly detalle?: Record<string, unknown>
  readonly correlacionId?: string

  constructor(
    status: number,
    codigo: string,
    mensaje: string,
    detalle?: Record<string, unknown>,
    correlacionId?: string,
  ) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.status = status
    this.codigo = codigo
    this.detalle = detalle
    this.correlacionId = correlacionId
  }

  /** Errores de validacion: un mapa campo -> mensaje. */
  get erroresDeCampo(): Record<string, string> {
    if (this.codigo !== 'VALIDACION' || !this.detalle) return {}
    return this.detalle as Record<string, string>
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = tokenActual()
  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opciones.headers,
      },
    })
  } catch {
    // Distinguir "el servidor dijo que no" de "no hubo servidor" importa:
    // el usuario necesita saber si debe arreglar el dato o llamar a soporte.
    throw new ErrorApi(0, 'SIN_CONEXION',
      'No se pudo contactar el servidor. Verifique que el backend este en ejecucion.')
  }

  if (respuesta.status === 204) return undefined as T

  const texto = await respuesta.text()
  const cuerpo = texto ? JSON.parse(texto) : null

  if (!respuesta.ok) {
    const e = cuerpo as CuerpoError | null
    // Token vencido o revocado: se avisa para que la sesion se cierre sola
    // en vez de dejar al usuario ante errores que no puede interpretar.
    if (respuesta.status === 401) {
      window.dispatchEvent(new Event('sesion-expirada'))
    }
    throw new ErrorApi(
      respuesta.status,
      e?.codigo ?? 'ERROR_DESCONOCIDO',
      e?.mensaje ?? `El servidor respondio ${respuesta.status}`,
      e?.detalle,
      e?.correlacionId,
    )
  }

  return cuerpo as T
}

export const api = {
  get: <T>(ruta: string) => pedir<T>(ruta),
  post: <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined }),
  patch: <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, { method: 'PATCH', body: cuerpo ? JSON.stringify(cuerpo) : undefined }),
}
