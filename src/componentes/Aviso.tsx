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
 * Muestra un error de la API tal como lo redacto el backend.
 *
 * No se reescribe el mensaje: el backend ya explica que paso y con que dato
 * concreto, por ejemplo el saldo real pendiente o las transiciones validas.
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
        {error.correlacionId && (
          <div className="codigo">{error.codigo} · correlación {error.correlacionId}</div>
        )}
      </Aviso>
    )
  }

  return <Aviso tono="error" titulo="Error inesperado">{String(error)}</Aviso>
}

function tituloDe(error: ErrorApi): string {
  switch (error.codigo) {
    case 'SIN_CONEXION': return 'Sin conexión con el servidor'
    case 'VALIDACION': return 'Revise los datos ingresados'
    case 'TRANSICION_INVALIDA': return 'Ese cambio de estado no es posible'
    case 'STOCK_INSUFICIENTE': return 'No hay stock suficiente'
    case 'RECURSO_NO_ENCONTRADO': return 'No se encontró'
    default: return 'No se pudo completar la operación'
  }
}
