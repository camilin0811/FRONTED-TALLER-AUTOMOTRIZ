/*
 * Para qué sirve: Inventario: repuestos, movimientos y órdenes de compra.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import { coincide } from '../texto'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAccionConfirmada } from '../componentes/interaccion'
import { useAutenticacion } from '../autenticacion/Contexto'
import { ETIQUETA_COMPRA, ETIQUETA_MOVIMIENTO } from '../estados'
import { inventario } from '../api/servicios'
import type { Movimiento, OrdenCompra, Repuesto } from '../api/tipos'
import { AvisoError } from '../componentes/Aviso'
import { Cargando, Vacio } from '../componentes/Cargando'
import { dinero, fecha, fechaHora } from '../formato'

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
  const [busqueda, setBusqueda] = useState('')
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false)

  const visibles = useMemo(() => {
    return repuestos
      .filter((r) => !soloBajoMinimo || r.stock <= r.stockMinimo)
      .filter((r) => coincide(busqueda, r.codigo, r.nombre))
  }, [repuestos, busqueda, soloBajoMinimo])

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

      <div className="fila filtros-inventario">
        <input type="search" placeholder="Buscar por código o nombre" value={busqueda}
               onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar repuestos por código o nombre" />
        {/* Envuelto y enlazado por id: el lector de pantalla anuncia
            "Solo bajo mínimo", no el valor "on". */}
        <label className="interruptor" htmlFor="solo-bajo-minimo">
          <input id="solo-bajo-minimo" type="checkbox" checked={soloBajoMinimo}
                 onChange={(e) => setSoloBajoMinimo(e.target.checked)} />
          Solo bajo mínimo
        </label>
      </div>

      {visibles.length === 0 ? (
        <Vacio>
          {repuestos.length === 0 ? 'No hay repuestos registrados.' : 'Ningún repuesto coincide con la búsqueda.'}
        </Vacio>
      ) : (
      <div className="tabla-desplazable">
      <table>
        <thead>
          <tr><th>Código</th><th>Repuesto</th><th>Stock</th><th>Mínimo</th>
            <th style={{ textAlign: 'right' }}>Precio</th></tr>
        </thead>
        <tbody>
          {visibles.map((r) => (
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
      </div>
      )}
      <p className="tenue" style={{ marginTop: 10 }}>
        Mostrando {visibles.length} de {repuestos.length} repuestos.
      </p>

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
        <div className="tabla-desplazable">
        <table>
          <thead>
            <tr><th>Número</th><th>Fecha</th><th>Generada por</th><th>Estado</th><th>Repuesto</th>
              <th>Pedido</th><th>Recibido</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <FilaCompra key={c.id} compra={c} puedeGestionar={puedeGestionar}
                          puedeRecibir={puedeRecibir} alActualizar={alActualizar} />
            ))}
          </tbody>
        </table>
        </div>
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
  const ejecutarConfirmado = useAccionConfirmada()

  const editable = compra.estado === 'BORRADOR' && puedeGestionar
  const recibible = (compra.estado === 'ENVIADA' || compra.estado === 'RECIBIDA_PARCIAL') && puedeRecibir
  const numero = Number(cantidad)
  const valida = Number.isInteger(numero) && numero > 0 && (!recibible || numero <= pendiente)

  async function ejecutar(
    opciones: { titulo: string; mensaje: React.ReactNode; confirmar: string; exito: string },
    accion: () => Promise<OrdenCompra>,
  ) {
    const actualizada = await ejecutarConfirmado({ ...opciones, alConfirmar: () => setOcupado(true) }, accion)
    setOcupado(false)
    if (!actualizada) return
    alActualizar(actualizada)
    const it = actualizada.items[0]
    if (it) setCantidad(String(actualizada.estado === 'BORRADOR' ? it.cantidad : it.cantidad - it.cantidadRecibida))
  }

  return (
    <>
      <tr>
        <td className="nowrap"><strong>{compra.numero}</strong></td>
        <td className="nowrap">{fecha(compra.fecha)}</td>
        <td>{compra.generadaPor ?? <span className="tenue">Automática</span>}</td>
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
                          onClick={() => ejecutar({
                            titulo: 'Cambiar cantidad', confirmar: 'Guardar cantidad',
                            mensaje: <>La orden <span className="nowrap">{compra.numero}</span> pedirá {numero} unidades de {item.codigoRepuesto} en lugar de {item.cantidad}.</>,
                            exito: `Cantidad actualizada a ${numero}.`,
                          }, () => inventario.ajustarCantidad(compra.id, item.codigoRepuesto, numero))}>
                    Guardar cantidad
                  </button>
                  <button className="primario" disabled={ocupado || numero !== item.cantidad}
                          title={numero !== item.cantidad ? 'Guarde la cantidad antes de enviar' : undefined}
                          onClick={() => ejecutar({
                            titulo: 'Enviar al proveedor', confirmar: 'Enviar',
                            mensaje: <>Se enviará la orden <span className="nowrap">{compra.numero}</span> por {item.cantidad} unidades
                              de {item.codigoRepuesto}. Después de enviarla ya no se puede editar.</>,
                            exito: `Orden ${compra.numero} enviada al proveedor.`,
                          }, () => inventario.enviarCompra(compra.id))}>
                    Enviar al proveedor
                  </button>
                </>
              )}
              {recibible && (
                <button className="exito" disabled={ocupado || !valida}
                        onClick={() => ejecutar({
                          titulo: 'Registrar recepción', confirmar: 'Registrar recepción',
                          mensaje: `Llegaron ${numero} unidades de ${item.codigoRepuesto}. Se sumarán al stock`
                            + (numero < pendiente ? ` y quedarán ${pendiente - numero} pendientes.` : ' y la orden quedará recibida.'),
                          exito: `Recepción registrada: +${numero} ${item.codigoRepuesto}.`,
                        }, () => inventario.recibirCompra(compra.id, item.codigoRepuesto, numero))}>
                  Registrar recepción
                </button>
              )}
            </div>
          ) : (
            <span className="tenue">{compra.estado === 'BORRADOR' ? 'En revisión por administración' : '—'}</span>
          )}
        </td>
      </tr>
    </>
  )
}
