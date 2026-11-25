/*
 * Para qué sirve: Cliente HTTP de la API: agrega el token, traduce los errores a ErrorApi y avisa
 * si la sesión expiró.
 * PATRÓN Facade: api.get/post/put/patch esconden fetch, cabeceras, JSON, tiempos de espera y manejo
 *     de errores detrás de una interfaz simple.
 * PATRÓN Observer (publicar/suscribir): ante un 401 emite el evento 'sesion-expirada', que escucha
 *     el contexto de autenticación.
 */
import type { CuerpoError } from './tipos'
import { tokenActual } from '../autenticacion/sesion'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

/**
 * Despierta al servidor sin molestar a nadie.
 *
 * El plan gratuito de Render duerme el backend tras 15 minutos sin trafico
 * y despertarlo tarda cerca de un minuto. Este ping sale apenas carga la
 * aplicacion, de modo que el servidor arranca mientras el usuario todavia
 * esta escribiendo sus credenciales.
 *
 * mode no-cors: la respuesta no se lee (no hace falta) y asi el navegador
 * no ensucia la consola si el actuator no comparte las cabeceras CORS.
 */
export function despertarServidor(): void {
  const raiz = BASE.replace(/\/api\/v1\/?$/, '')
  fetch(`${raiz}/actuator/health`, { mode: 'no-cors', cache: 'no-store' })
    .catch(() => { /* si falla, el login ya mostrara su propio aviso */ })
}

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

  /** No hubo respuesta: sin internet, servidor caido o bloqueado en el camino. */
  get esDeRed(): boolean { return this.status === 0 }
  /** El servidor rechazo la peticion por algo de la peticion (dato, permiso, limite). */
  get esDelCliente(): boolean { return this.status >= 400 && this.status < 500 }
  /** El servidor fallo o no esta disponible: no es culpa de quien consulta. */
  get esDelServidor(): boolean { return this.status >= 500 }

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
    // el usuario necesita saber si debe arreglar el dato o reintentar.
    // Tambien cae aqui una respuesta bloqueada en el camino sin cabeceras
    // CORS: para el navegador es indistinguible de no tener conexion.
    throw new ErrorApi(0, 'SIN_CONEXION',
      'No pudimos comunicarnos con el taller. Revise su conexión a internet e intente de nuevo.')
  }

  if (respuesta.status === 204) return undefined as T

  // Un proxy o un firewall pueden responder HTML en lugar de JSON: leerlo
  // como JSON reventaria con un error ilegible para el usuario.
  const texto = await respuesta.text()
  let cuerpo: unknown = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = null
  }

  if (!respuesta.ok) {
    if (respuesta.status >= 500) {
      // El detalle tecnico de un 5xx no le sirve a quien consulta.
      throw new ErrorApi(respuesta.status, 'SERVICIO_NO_DISPONIBLE',
        'El servicio no está disponible en este momento. Intente de nuevo en unos minutos.',
        undefined, (cuerpo as CuerpoError | null)?.correlacionId)
    }
    const e = cuerpo as CuerpoError | null
    // Token vencido o revocado: se avisa para que la sesion se cierre sola
    // en vez de dejar al usuario ante errores que no puede interpretar.
    if (respuesta.status === 401) {
      // PATRÓN Observer: se emite el evento; Contexto.tsx está suscrito y cierra la sesión.
      window.dispatchEvent(new Event('sesion-expirada'))
    }
    throw new ErrorApi(
      respuesta.status,
      e?.codigo ?? 'ERROR_DESCONOCIDO',
      e?.mensaje ?? 'No se pudo completar la solicitud. Revise los datos e intente de nuevo.',
      e?.detalle,
      e?.correlacionId,
    )
  }

  return cuerpo as T
}

// PATRÓN Facade: interfaz simple sobre fetch para todo el frontend.
export const api = {
  get: <T>(ruta: string) => pedir<T>(ruta),
  post: <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined }),
  patch: <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, { method: 'PATCH', body: cuerpo ? JSON.stringify(cuerpo) : undefined }),
}
