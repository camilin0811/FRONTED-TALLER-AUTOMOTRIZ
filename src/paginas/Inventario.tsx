import { Fragment, useEffect, useState } from 'react'
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
                              <td>{m.tipo}</td>
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
      {compras.length === 0 ? (
        <Vacio>No hay órdenes de compra. Se generan solas cuando un repuesto llega al mínimo.</Vacio>
      ) : (
        <table>
          <thead>
            <tr><th>Número</th><th>Estado</th><th>Repuesto</th><th>Cantidad</th><th>Recibido</th></tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.numero}</strong></td>
                <td>
                  <span className={`estado ${c.estado === 'BORRADOR' ? 'ambar' : 'gris'}`}>{c.estado}</span>
                </td>
                <td className="codigos">{c.items[0]?.codigoRepuesto ?? '—'}</td>
                <td>{c.items[0]?.cantidad ?? 0}</td>
                <td>{c.items[0]?.cantidadRecibida ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
