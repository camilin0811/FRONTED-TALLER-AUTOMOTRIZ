import { useAccionConfirmada } from '../componentes/interaccion'
import { useCallback, useEffect, useState } from 'react'
import { ordenes } from '../api/servicios'
import type { OrdenDetalle, OrdenResumen } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { Cargando, Vacio } from '../componentes/Cargando'
import { dinero } from '../formato'

/**
 * Vista del mecánico, pensada para tablet.
 *
 * Objetivos táctiles grandes y maestro-detalle en horizontal: se opera con
 * guantes y sin perder de vista las demás órdenes asignadas.
 */
export function VistaMecanico() {
  const ejecutarConfirmado = useAccionConfirmada()
  const [lista, setLista] = useState<OrdenResumen[]>([])
  const [sel, setSel] = useState<OrdenDetalle | null>(null)
  const [codigo, setCodigo] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState<unknown>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  const cargarLista = useCallback(() => {
    setCargando(true)
    Promise.all([
      ordenes.listar({ estado: 'EN_REPARACION' }),
      ordenes.listar({ estado: 'EN_ESPERA_REPUESTO' }),
      ordenes.listar({ estado: 'APROBADA' }),
    ])
      .then(([a, b, c]) => setLista([...a, ...b, ...c]))
      .catch(setError)
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargarLista() }, [cargarLista])

  function abrir(id: string) {
    setError(null)
    ordenes.detalle(id).then(setSel).catch(setError)
  }

  /** Confirmacion propia, toast con el resultado y relectura de la orden. */
  async function ejecutar(
    opciones: { titulo: string; mensaje: string; confirmar: string; exito: string },
    accion: () => Promise<OrdenDetalle>,
  ) {
    setOcupado(true)
    setError(null)
    const actualizada = await ejecutarConfirmado(opciones, accion)
    if (actualizada) setSel(actualizada)
    else if (sel) abrir(sel.id)
    setOcupado(false)
    cargarLista()
  }

  if (cargando) return <Cargando que="tus órdenes" />

  return (
    <div className="tactil">
      <div className="encabezado">
        <h2>Mi trabajo</h2>
        <span className="tenue">{lista.length} órdenes asignadas</span>
      </div>

      <AvisoError error={error} />

      <div className="maestro-detalle">
        <div className="maestro">
          {lista.length === 0 && <Vacio>Sin órdenes asignadas.</Vacio>}
          {lista.map((o) => (
            <div
              key={o.id}
              className={`tarjeta-orden ${sel?.id === o.id ? 'seleccionada' : ''}`}
              onClick={() => abrir(o.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => ev.key === 'Enter' && abrir(o.id)}
            >
              <div className="ot">{o.numero}</div>
              <div className="tenue">{o.descripcionVehiculo} · {o.placa}</div>
              <div style={{ marginTop: 6 }}><Estado valor={o.estado} /></div>
            </div>
          ))}
        </div>

        <div className="detalle">
          {!sel ? (
            <Vacio>Elija una orden para ver el detalle.</Vacio>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>{sel.numero} · {sel.descripcionVehiculo}</h3>
              <p className="tenue">
                {sel.placa} · {sel.kilometrajeIngreso.toLocaleString('es-CO')} km · <Estado valor={sel.estado} />
              </p>

              {sel.codigosFalla.length > 0 && (
                <div className="panel">
                  <h3>Diagnóstico OBD-II</h3>
                  <div className="codigos">{sel.codigosFalla.join('  ·  ')}</div>
                </div>
              )}

              <div className="panel">
                <h3>Repuestos consumidos</h3>
                {sel.repuestos.length === 0 ? (
                  <p className="tenue">Ninguno todavía.</p>
                ) : (
                  <table>
                    <tbody>
                      {sel.repuestos.map((r, i) => (
                        <tr key={i}>
                          <td className="codigos">{r.codigo}</td>
                          <td>{r.descripcion}</td>
                          <td>{r.cantidad} u.</td>
                          <td className="numero">{dinero(r.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {sel.estado === 'EN_REPARACION' && (
                  <div className="fila" style={{ marginTop: 14, alignItems: 'flex-end' }}>
                    <div>
                      <label htmlFor="cod">Código del repuesto</label>
                      <input id="cod" value={codigo} placeholder="PAST-001"
                             onChange={(ev) => setCodigo(ev.target.value.toUpperCase())} />
                    </div>
                    <div style={{ maxWidth: 110 }}>
                      <label htmlFor="cant">Cantidad</label>
                      <input id="cant" type="number" min={1} value={cantidad}
                             onChange={(ev) => setCantidad(Number(ev.target.value))} />
                    </div>
                    <button className="secundario" disabled={ocupado || !codigo}
                            onClick={() => ejecutar({
                              titulo: 'Registrar repuesto',
                              mensaje: `Se descontarán ${cantidad} unidad(es) de ${codigo} del inventario `
                                + `y se cargarán a la orden ${sel.numero ?? ''}.`,
                              confirmar: 'Registrar', exito: `Repuesto ${codigo} registrado.`,
                            }, () => ordenes.registrarRepuesto(sel.id, codigo, cantidad))}>
                      + Registrar repuesto
                    </button>
                  </div>
                )}
              </div>

              {/* Finalizar dispara la facturacion, asi que se mantiene lejos
                  de las acciones rutinarias. */}
              <div className="acciones">
                {sel.estado === 'EN_REPARACION' && (
                  <>
                    <button className="exito" disabled={ocupado}
                            onClick={() => ejecutar({
                              titulo: 'Finalizar trabajo',
                              mensaje: 'La orden pasará a «Cerrada» y se generará la factura automáticamente. '
                                + 'Ya no podrá registrar más repuestos.',
                              confirmar: 'Finalizar trabajo', exito: 'Trabajo finalizado. Se está generando la factura.',
                            }, () => ordenes.transicionar(sel.id, 'CERRADA'))}>
                      Finalizar trabajo
                    </button>
                    <button className="secundario" disabled={ocupado}
                            onClick={() => ejecutar({
                              titulo: 'Reportar falta de repuesto',
                              mensaje: 'La orden pasará a «En espera de repuesto» hasta que el repuesto llegue.',
                              confirmar: 'Reportar', exito: 'Orden en espera de repuesto.',
                            }, () => ordenes.transicionar(sel.id, 'EN_ESPERA_REPUESTO'))}>
                      Reportar falta de repuesto
                    </button>
                  </>
                )}
                {sel.estado === 'EN_ESPERA_REPUESTO' && (
                  <Aviso tono="alerta" titulo="Orden bloqueada">
                    Falta un repuesto. Se generó una orden de compra que administración revisará;
                    cuando llegue el repuesto, recepción reanudará la reparación.
                  </Aviso>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
