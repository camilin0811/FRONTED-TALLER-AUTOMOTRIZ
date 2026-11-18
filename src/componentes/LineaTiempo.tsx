import type { EstadoOrden, Hito } from '../api/tipos'
import { soloFecha, soloHora } from '../formato'
import { etiquetaEstado } from '../estados'

/** Camino feliz que ve el cliente; los desvios se muestran aparte. */
const CAMINO: EstadoOrden[] = [
  'RECIBIDA', 'EN_DIAGNOSTICO', 'COTIZADA', 'APROBADA',
  'EN_REPARACION', 'CERRADA', 'FACTURADA', 'ENTREGADA',
]

export function LineaTiempo({ historial, actual }: { historial: Hito[]; actual: EstadoOrden }) {
  const estados = historial.filter((h): h is Hito & { estado: EstadoOrden } => h.estado != null)
  const alcanzados = new Set(estados.map((h) => h.estado))
  const cuando = new Map(estados.map((h) => [h.estado, h.fecha]))
  const indiceActual = CAMINO.indexOf(actual)

  return (
    <div className="linea-tiempo">
      {CAMINO.map((estado, i) => {
        const esActual = estado === actual
        const cumplido = !esActual && (alcanzados.has(estado) || (indiceActual > -1 && i < indiceActual))
        const clase = esActual ? 'actual' : cumplido ? 'cumplido' : 'pendiente'
        return (
          <div key={estado} className={`hito ${clase}`}>
            <div className="punto" />
            <div className="titulo">{etiquetaEstado(estado)}</div>
            {cuando.has(estado) && (
              // Fecha y hora en dos lineas: juntas no caben en la columna y
              // se montaban sobre la etapa vecina.
              <time className="cuando" dateTime={cuando.get(estado)}>
                <span>{soloFecha(cuando.get(estado))}</span>
                <span>{soloHora(cuando.get(estado))}</span>
              </time>
            )}
          </div>
        )
      })}
    </div>
  )
}
