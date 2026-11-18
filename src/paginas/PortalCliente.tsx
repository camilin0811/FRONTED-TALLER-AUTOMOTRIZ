import { ETIQUETA_ESTADO } from '../estados'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { publico } from '../api/servicios'
import type { OrdenDetalle } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { ErrorApi } from '../api/cliente'
import { LineaTiempo } from '../componentes/LineaTiempo'
import { dinero, fecha } from '../formato'
import { CocheEscaparate } from '../componentes/CocheEscaparate'

/** Placa: solo letras y números. Espacios y guiones se quitan al escribir. */
const PLACA_MAX = 8
const limpiarPlaca = (v: string) => v.toUpperCase().replace(/[\s-]/g, '').replace(/[^A-Z0-9]/g, '')
const limpiarDocumento = (v: string) => v.replace(/\D/g, '')

/** Mismas reglas que valida el servidor; aqui solo ahorran el viaje. */
function validar(placa: string, documento: string): { placa?: string; documento?: string } {
  const errores: { placa?: string; documento?: string } = {}
  if (!/^[A-Z0-9]{3,8}$/.test(placa)) {
    errores.placa = 'Escriba la placa con letras y números (entre 3 y 8), sin espacios ni guiones.'
  }
  if (!/^\d{5,15}$/.test(documento)) {
    errores.documento = 'Escriba solo los números del documento (entre 5 y 15 dígitos).'
  }
  return errores
}

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
  const [errores, setErrores] = useState<{ placa?: string; documento?: string }>({})

  async function buscar(ev: React.FormEvent) {
    ev.preventDefault()
    const encontrados = validar(placa, documento)
    setErrores(encontrados)
    if (encontrados.placa || encontrados.documento) return

    setBuscando(true)
    setError(null)
    setOrden(null)
    setSinResultado(false)
    try {
      // Exige placa y documento: solo con la placa, cualquiera podría ver
      // cuánto paga un tercero por su reparación.
      setOrden(await publico.consultarOrden(placa, documento))
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 404) setSinResultado(true)
      else setError(e)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <>
      <header className="portal-barra">
        <Link to="/" className="portal-marca">Taller Automotriz · Portal del cliente</Link>
        <Link to="/acceso" className="enlace-barra">Volver al acceso del taller</Link>
      </header>
      <div className="portal">
        <div className="portal-presentacion">
          <div className="texto">
            <h2>Consulte su vehículo</h2>
            <p className="tenue">
              Ingrese la placa y su número de documento para ver el estado de su orden.
            </p>
          </div>
          <CocheEscaparate className="portal-coche" />
        </div>

        {/* Los ejemplos no coinciden con ninguna orden real: un ejemplo que
            funciona deja ver los datos de otra persona. */}
        <form onSubmit={buscar} className="fila" noValidate style={{ alignItems: 'flex-start', marginBottom: 20 }}>
          <div className="campo">
            <label htmlFor="placa">Placa</label>
            <input id="placa" name="placa" value={placa} placeholder="Ej.: XYZ987" required
                   maxLength={PLACA_MAX} autoComplete="off" autoCapitalize="characters"
                   aria-invalid={Boolean(errores.placa)}
                   aria-describedby={errores.placa ? 'placa-error' : undefined}
                   onChange={(e) => setPlaca(limpiarPlaca(e.target.value))} />
            {errores.placa && <div className="error-campo" id="placa-error">{errores.placa}</div>}
          </div>
          <div className="campo">
            <label htmlFor="documento">Documento del titular</label>
            <input id="documento" name="documento" value={documento} placeholder="Número de documento"
                   required inputMode="numeric" maxLength={15} autoComplete="off"
                   aria-invalid={Boolean(errores.documento)}
                   aria-describedby={errores.documento ? 'documento-error' : undefined}
                   onChange={(e) => setDocumento(limpiarDocumento(e.target.value))} />
            {errores.documento && (
              <div className="error-campo" id="documento-error">{errores.documento}</div>
            )}
          </div>
          <button className="primario boton-consulta" type="submit" disabled={buscando}>
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
                La factura estará disponible cuando la orden pase a «{ETIQUETA_ESTADO.FACTURADA}».
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
