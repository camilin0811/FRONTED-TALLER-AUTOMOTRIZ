/*
 * Para qué sirve: Muestra avisos y errores de la API con el mensaje que redactó el servidor.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import { ErrorApi } from '../api/cliente'

type Tono = 'error' | 'alerta' | 'exito' | 'info'

const ICONO: Record<Tono, string> = { error: '!', alerta: '!', exito: '\u2713', info: 'i' }

export function Aviso(
  { tono = 'info', titulo, children }:
  { tono?: Tono; titulo?: string; children: React.ReactNode },
) {
  return (
    <div className={`aviso ${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <span className="icono">{ICONO[tono]}</span>
      <div className="texto">
        {titulo && <div className="titulo">{titulo}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}

/**
 * Muestra un error de la API.
 *
 * Los 4xx se muestran tal como los redacto el servidor: explican que paso y
 * con que dato concreto, por ejemplo el saldo pendiente o las transiciones
 * validas. Los 5xx y los fallos de red ya llegan con un mensaje amable desde
 * el cliente de la API, sin detalles tecnicos.
 */
export function AvisoError({ error }: { error: unknown }) {
  if (!error) return null

  if (error instanceof ErrorApi) {
    const campos = error.erroresDeCampo
    return (
      <Aviso tono="error" titulo={tituloDe(error)}>
        {Object.keys(campos).length > 0 ? (
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {Object.entries(campos).map(([campo, mensaje]) => (
              <li key={campo}><strong>{campo}</strong>: {mensaje}</li>
            ))}
          </ul>
        ) : (
          error.message
        )}
        {/* El identificador solo sirve para reportar fallas del servidor; en
            un error de datos o de limite es ruido tecnico para el cliente. */}
        {error.esDelServidor && error.correlacionId && (
          <div className="codigo">{error.codigo} · correlación {error.correlacionId}</div>
        )}
      </Aviso>
    )
  }

  return (
    <Aviso tono="error" titulo="Algo salió mal">
      Ocurrió un error inesperado. Recargue la página e intente de nuevo.
    </Aviso>
  )
}

function tituloDe(error: ErrorApi): string {
  switch (error.codigo) {
    case 'SIN_CONEXION': return 'Sin conexión'
    case 'SERVICIO_NO_DISPONIBLE': return 'Servicio no disponible'
    case 'DEMASIADAS_SOLICITUDES': return 'Demasiadas consultas seguidas'
    case 'CREDENCIALES_INVALIDAS': return 'Usuario o clave incorrectos'
    case 'VALIDACION': return 'Revise los datos ingresados'
    case 'TRANSICION_INVALIDA': return 'Ese cambio de estado no es posible'
    case 'STOCK_INSUFICIENTE': return 'No hay stock suficiente'
    case 'RECURSO_NO_ENCONTRADO': return 'No se encontró'
    default: return 'No se pudo completar la operación'
  }
}
