import type { EstadoOrden, Hito } from '../api/tipos'
import { fechaHora, legible } from '../formato'

/** Camino feliz que ve el cliente; los desvios se muestran aparte. */
const CAMINO: EstadoOrden[] = [
  'RECIBIDA', 'EN_DIAGNOSTICO', 'COTIZADA', 'APROBADA',
  'EN_REPARACION', 'CERRADA', 'FACTURADA', 'ENTREGADA',
]

export function LineaTiempo({ historial, actual }: { historial: Hito[]; actual: EstadoOrden }) {
  const alcanzados = new Set(historial.map((h) => h.estado))
  const cuando = new Map(historial.map((h) => [h.estado, h.fecha]))
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
            <div className="titulo">{legible(estado)}</div>
            {cuando.has(estado) && <div className="cuando">{fechaHora(cuando.get(estado))}</div>}
          </div>
        )
      })}
    </div>
  )
}
