import { useState } from 'react'
import { publico } from '../api/servicios'
import type { OrdenDetalle } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { ErrorApi } from '../api/cliente'
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
  const [documento, setDocumento] = useState('')
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
      // Exige placa y documento: solo con la placa, cualquiera podría ver
      // cuánto paga un tercero por su reparación.
      setOrden(await publico.consultarOrden(placa.trim().toUpperCase(), documento.trim()))
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 404) setSinResultado(true)
      else setError(e)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <>
      <div className="portal-barra">Taller Automotriz · Portal del Cliente</div>
      <div className="portal">
        <h2>Consulte su vehículo</h2>
        <p className="tenue">
          Ingrese la placa y su número de documento para ver el estado de su orden.
        </p>

        <form onSubmit={buscar} className="fila" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <label htmlFor="placa">Placa</label>
            <input id="placa" value={placa} placeholder="ABC123" required
                   onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label htmlFor="documento">Documento del titular</label>
            <input id="documento" value={documento} placeholder="10000001" required
                   onChange={(e) => setDocumento(e.target.value)} />
          </div>
          <button className="primario" type="submit" disabled={buscando} style={{ flex: '0 0 auto' }}>
            {buscando ? 'Buscando…' : 'Consultar'}
          </button>
        </form>

        <AvisoError error={error} />
        {sinResultado && (
          <Aviso tono="info" titulo="No encontramos órdenes con esos datos">
            Verifique la placa y el documento del titular, o comuníquese con el taller.
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
