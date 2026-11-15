import { useState } from 'react'
import { ordenes } from '../api/servicios'
import type { OrdenDetalle, OrdenResumen } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { LineaTiempo } from '../componentes/LineaTiempo'
import { dinero, fecha } from '../formato'

/**
 * Portal público del cliente.
 *
 * Responde la pregunta que hoy se hace por teléfono: ¿en qué va mi vehículo?
 * Por eso la línea de tiempo es lo primero que se ve.
 */
export function PortalCliente() {
  const [placa, setPlaca] = useState('')
  const [orden, setOrden] = useState<OrdenDetalle | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [buscando, setBuscando] = useState(false)
  const [sinResultado, setSinResultado] = useState(false)

  async function buscar(ev: React.FormEvent) {
    ev.preventDefault()
    setBuscando(true)
    setError(null)
    setOrden(null)
    setSinResultado(false)
    try {
      const lista: OrdenResumen[] = await ordenes.listar({ placa: placa.trim().toUpperCase() })
      if (lista.length === 0) { setSinResultado(true); return }
      // La más reciente es la que al cliente le interesa.
      const reciente = [...lista].sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso))[0]
      setOrden(await ordenes.detalle(reciente.id))
    } catch (e) {
      setError(e)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <>
      <div className="portal-barra">Taller Automotriz · Portal del Cliente</div>
      <div className="portal">
        <h2>Consulte su vehículo</h2>
        <p className="tenue">Ingrese la placa para ver el estado de su orden.</p>

        <form onSubmit={buscar} className="fila" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <label htmlFor="placa">Placa</label>
            <input id="placa" value={placa} placeholder="ABC123" required
                   onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
          </div>
          <button className="primario" type="submit" disabled={buscando} style={{ flex: '0 0 auto' }}>
            {buscando ? 'Buscando…' : 'Consultar'}
          </button>
        </form>

        <AvisoError error={error} />
        {sinResultado && (
          <Aviso tono="info" titulo="No encontramos órdenes para esa placa">
            Verifique el número o comuníquese con el taller.
          </Aviso>
        )}

        {orden && (
          <>
            <div className="encabezado">
              <h2 style={{ margin: 0 }}>Orden {orden.numero}</h2>
              <Estado valor={orden.estado} />
            </div>
            <p className="tenue">
              {orden.descripcionVehiculo} · {orden.placa} · ingreso {fecha(orden.fechaIngreso)}
              {orden.fechaEntrega && <> · entregado {fecha(orden.fechaEntrega)}</>}
            </p>

            <LineaTiempo historial={orden.historial} actual={orden.estado} />

            <div className="panel">
              <h3>Trabajos {orden.estadoCotizacion === 'APROBADA' ? 'aprobados' : 'cotizados'}</h3>
              {orden.servicios.length === 0 && orden.repuestos.length === 0 ? (
                <p className="tenue">Aún no hay trabajos registrados.</p>
              ) : (
                <table>
                  <tbody>
                    {[...orden.servicios, ...orden.repuestos].map((i, n) => (
                      <tr key={n}>
                        <td>{i.descripcion}{i.cantidad > 1 && ` · ${i.cantidad} unidades`}</td>
                        <td className="numero">{dinero(i.valor)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total</strong></td>
                      <td className="numero"><strong>{dinero(orden.total)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {orden.mecanico && (
              <div className="panel">
                <h3>Su mecánico</h3>
                <p style={{ margin: 0 }}>{orden.mecanico}</p>
              </div>
            )}

            {orden.estado === 'COTIZADA' && (
              <Aviso tono="alerta" titulo="Su cotización espera respuesta">
                Le enviamos la cotización por WhatsApp. Responda <strong>APRUEBO</strong> para
                que comencemos el trabajo.
              </Aviso>
            )}

            {/* Un botón inerte sin explicación genera llamadas a soporte. */}
            {!orden.idFactura && (
              <p className="tenue">
                La factura estará disponible cuando la orden pase a FACTURADA.
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
