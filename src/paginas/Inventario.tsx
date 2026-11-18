import { Fragment, useEffect, useState } from 'react'
import { useAutenticacion } from '../autenticacion/Contexto'
import { ETIQUETA_COMPRA, ETIQUETA_MOVIMIENTO } from '../estados'
import { inventario } from '../api/servicios'
import type { Movimiento, OrdenCompra, Repuesto } from '../api/tipos'
import { AvisoError } from '../componentes/Aviso'
import { Cargando, Vacio } from '../componentes/Cargando'
import { dinero, fechaHora } from '../formato'

export function Inventario() {
  const [repuestos, setRepuestos] = useState<Repuesto[]>([])
  const [compras, setCompras] = useState<OrdenCompra[]>([])
  const [abierto, setAbierto] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [error, setError] = useState<unknown>(null)
  const [cargando, setCargando] = useState(true)
  const { tieneRol } = useAutenticacion()
  const puedeGestionar = tieneRol('ADMINISTRADOR')
  const puedeRecibir = tieneRol('ADMINISTRADOR', 'RECEPCIONISTA')

  /** Tras cada paso se refresca la orden y el stock, que la recepcion cambia. */
  async function alActualizar(compra: OrdenCompra) {
    setCompras((actuales) => actuales.map((c) => (c.id === compra.id ? compra : c)))
    inventario.listar().then(setRepuestos).catch(setError)
  }

  useEffect(() => {
    Promise.all([inventario.listar(), inventario.ordenesCompra()])
      .then(([r, c]) => { setRepuestos(r); setCompras(c) })
      .catch(setError)
      .finally(() => setCargando(false))
  }, [])

  function alternar(codigo: string) {
    if (abierto === codigo) { setAbierto(null); return }
    setAbierto(codigo)
    inventario.movimientos(codigo).then(setMovimientos).catch(setError)
  }

  if (cargando) return <Cargando que="el inventario" />

  return (
    <>
      <div className="encabezado"><h2>Inventario</h2></div>
      <AvisoError error={error} />

      <table>
        <thead>
          <tr><th>Código</th><th>Repuesto</th><th>Stock</th><th>Mínimo</th>
            <th style={{ textAlign: 'right' }}>Precio</th></tr>
        </thead>
        <tbody>
          {repuestos.map((r) => (
            <Fragment key={r.codigo}>
              <tr className="clicable" onClick={() => alternar(r.codigo)}>
                <td className="codigos">{r.codigo}</td>
                <td>{r.nombre}</td>
                <td>
                  {r.stock}
                  {r.stock <= r.stockMinimo && (
                    <span className="estado rojo" style={{ marginLeft: 8 }}>BAJO MÍNIMO</span>
                  )}
                </td>
                <td>{r.stockMinimo}</td>
                <td className="numero">{dinero(r.precio)}</td>
              </tr>
              {abierto === r.codigo && (
                <tr className="fila-detalle">
                  <td colSpan={5}>
                    <strong>Movimientos</strong>
                    {movimientos.length === 0 ? (
                      <p className="tenue">Sin movimientos registrados.</p>
                    ) : (
                      <table>
                        <tbody>
                          {movimientos.map((m) => (
                            <tr key={m.id}>
                              <td>{fechaHora(m.fecha)}</td>
                              <td>{ETIQUETA_MOVIMIENTO[m.tipo] ?? m.tipo}</td>
                              <td>{m.cantidad}</td>
                              <td>{m.motivo}</td>
                              <td className="numero">queda {m.stockResultante}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 28 }}>Órdenes de compra</h3>
      <p className="tenue" style={{ marginTop: -6 }}>
        {puedeGestionar
          ? 'Revise la cantidad de cada borrador antes de enviarlo al proveedor. Al llegar la mercancía, registre la recepción para sumar el stock.'
          : puedeRecibir
            ? 'Cuando llegue la mercancía de una orden enviada, registre la recepción para sumar el stock.'
            : 'Consulta del estado de las compras de repuestos.'}
      </p>
      {compras.length === 0 ? (
        <Vacio>No hay órdenes de compra. Se generan solas cuando un repuesto llega al mínimo.</Vacio>
      ) : (
        <table>
          <thead>
            <tr><th>Número</th><th>Estado</th><th>Repuesto</th><th>Pedido</th><th>Recibido</th>
              <th>Acciones</th></tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <FilaCompra key={c.id} compra={c} puedeGestionar={puedeGestionar}
                          puedeRecibir={puedeRecibir} alActualizar={alActualizar} />
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

const TONO_COMPRA: Record<OrdenCompra['estado'], string> = {
  BORRADOR: 'ambar', ENVIADA: 'gris', RECIBIDA_PARCIAL: 'ambar', RECIBIDA: 'verde', ANULADA: 'rojo',
}

/**
 * Una orden de compra con las acciones que el rol puede ejecutar en su
 * estado: el administrador ajusta y envia el borrador; administrador y
 * recepcion registran lo que llega. El backend aplica las mismas reglas.
 */
function FilaCompra({ compra, puedeGestionar, puedeRecibir, alActualizar }: {
  compra: OrdenCompra
  puedeGestionar: boolean
  puedeRecibir: boolean
  alActualizar: (c: OrdenCompra) => void
}) {
  const item = compra.items[0]
  const pendiente = item ? item.cantidad - item.cantidadRecibida : 0
  const [cantidad, setCantidad] = useState(String(compra.estado === 'BORRADOR' ? item?.cantidad ?? 1 : pendiente))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const editable = compra.estado === 'BORRADOR' && puedeGestionar
  const recibible = (compra.estado === 'ENVIADA' || compra.estado === 'RECIBIDA_PARCIAL') && puedeRecibir
  const numero = Number(cantidad)
  const valida = Number.isInteger(numero) && numero > 0 && (!recibible || numero <= pendiente)

  async function ejecutar(accion: () => Promise<OrdenCompra>) {
    setOcupado(true)
    setError(null)
    try {
      const actualizada = await accion()
      alActualizar(actualizada)
      const it = actualizada.items[0]
      if (it) setCantidad(String(actualizada.estado === 'BORRADOR' ? it.cantidad : it.cantidad - it.cantidadRecibida))
    } catch (e) {
      setError(e)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <tr>
        <td><strong>{compra.numero}</strong></td>
        <td><span className={`estado ${TONO_COMPRA[compra.estado]}`}>{ETIQUETA_COMPRA[compra.estado]}</span></td>
        <td className="codigos">{item?.codigoRepuesto ?? '—'}</td>
        <td>{item?.cantidad ?? 0}</td>
        <td>{item?.cantidadRecibida ?? 0}</td>
        <td>
          {item && (editable || recibible) ? (
            <div className="acciones-compra">
              <input type="number" min={1} max={recibible ? pendiente : 10000} value={cantidad}
                     aria-label={recibible ? `Cantidad recibida de ${item.codigoRepuesto}` : `Cantidad a pedir de ${item.codigoRepuesto}`}
                     onChange={(e) => setCantidad(e.target.value)} disabled={ocupado} />
              {editable && (
                <>
                  <button className="secundario" disabled={ocupado || !valida || numero === item.cantidad}
                          onClick={() => ejecutar(() => inventario.ajustarCantidad(compra.id, item.codigoRepuesto, numero))}>
                    Guardar cantidad
                  </button>
                  <button className="primario" disabled={ocupado || numero !== item.cantidad}
                          title={numero !== item.cantidad ? 'Guarde la cantidad antes de enviar' : undefined}
                          onClick={() => ejecutar(() => inventario.enviarCompra(compra.id))}>
                    Enviar al proveedor
                  </button>
                </>
              )}
              {recibible && (
                <button className="exito" disabled={ocupado || !valida}
                        onClick={() => ejecutar(() => inventario.recibirCompra(compra.id, item.codigoRepuesto, numero))}>
                  Registrar recepción
                </button>
              )}
            </div>
          ) : (
            <span className="tenue">{compra.estado === 'BORRADOR' ? 'En revisión por administración' : '—'}</span>
          )}
        </td>
      </tr>
      {error !== null && (
        <tr className="fila-detalle"><td colSpan={6}><AvisoError error={error} /></td></tr>
      )}
    </>
  )
}
