import { EN_PROCESO, POR_ENTREGAR, etiquetaEstado } from '../estados'
import { useAutenticacion } from '../autenticacion/Contexto'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { inventario, ordenes } from '../api/servicios'
import type { OrdenCompra, OrdenResumen, EstadoOrden } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { Cargando, Vacio } from '../componentes/Cargando'
import { dinero, fecha } from '../formato'

/**
 * El tablero muestra todo vehiculo que sigue en el taller: las ordenes
 * activas (en trabajo) y las que solo esperan la entrega. Las rechazadas
 * entran porque tambien hay que registrar su entrega.
 */
const VIGILADOS: EstadoOrden[] = [...EN_PROCESO, ...POR_ENTREGAR]

type Filtro = EstadoOrden | 'TODOS' | 'ACTIVAS' | 'POR_ENTREGAR'

function cumpleFiltro(estado: EstadoOrden, filtro: Filtro): boolean {
  if (filtro === 'TODOS') return true
  if (filtro === 'ACTIVAS') return EN_PROCESO.includes(estado)
  if (filtro === 'POR_ENTREGAR') return POR_ENTREGAR.includes(estado)
  return estado === filtro
}

export function PanelRecepcion() {
  const navegar = useNavigate()
  const { tieneRol } = useAutenticacion()
  const [lista, setLista] = useState<OrdenResumen[]>([])
  const [compras, setCompras] = useState<OrdenCompra[]>([])
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)

    // El backend filtra por un estado a la vez; el tablero necesita verlos
    // todos, asi que se consultan en paralelo y se unen aqui.
    Promise.all([
      Promise.all(VIGILADOS.map((e) => ordenes.listar({ estado: e }))),
      inventario.ordenesCompra().catch(() => [] as OrdenCompra[]),
    ])
      .then(([porEstado, oc]) => {
        if (!vigente) return
        setLista(porEstado.flat())
        setCompras(oc)
      })
      .catch((e) => vigente && setError(e))
      .finally(() => vigente && setCargando(false))

    return () => { vigente = false }
  }, [])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toUpperCase()
    return lista
      .filter((o) => cumpleFiltro(o.estado, filtro))
      .filter((o) => !texto
        || o.placa?.toUpperCase().includes(texto)
        || o.numero?.toUpperCase().includes(texto)
        || o.cliente?.toUpperCase().includes(texto))
      .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso))
  }, [lista, filtro, busqueda])

  const activas = lista.filter((o) => EN_PROCESO.includes(o.estado)).length
  const porEntregar = lista.filter((o) => POR_ENTREGAR.includes(o.estado)).length
  const esperanAprobacion = lista.filter((o) => o.estado === 'COTIZADA').length
  const sinRepuesto = lista.filter((o) => o.estado === 'EN_ESPERA_REPUESTO').length
  const facturado = lista.filter((o) => ['FACTURADA'].includes(o.estado))
    .reduce((suma, o) => suma + (o.total ?? 0), 0)
  // Cada aviso de compras solo aparece a quien puede atenderlo: revisar y
  // enviar es del administrador; recibir la mercancia, tambien de recepcion.
  const porRevisar = tieneRol('ADMINISTRADOR') ? compras.filter((c) => c.estado === 'BORRADOR') : []
  const porRecibir = tieneRol('ADMINISTRADOR', 'RECEPCIONISTA')
    ? compras.filter((c) => c.estado === 'ENVIADA' || c.estado === 'RECIBIDA_PARCIAL')
    : []

  if (cargando) return <Cargando que="el tablero" />

  return (
    <>
      <div className="encabezado">
        <h2>Tablero de órdenes</h2>
        <div className="encabezado-acciones">
          <span className="tenue">{fecha(new Date().toISOString())}</span>
          <Link to="/ordenes/nueva" className="boton-enlace primario">+ Nueva orden</Link>
        </div>
      </div>

      <AvisoError error={error} />

      <div className="indicadores">
        <Indicador rotulo="Activas" valor={activas} />
        <Indicador rotulo="Esperan aprobación" valor={esperanAprobacion} tono="aviso" />
        <Indicador rotulo="Sin repuesto" valor={sinRepuesto} tono="error" />
        <Indicador rotulo="Facturado" valor={dinero(facturado)} tono="ok" />
      </div>

      {porRevisar.map((c) => (
        <Aviso key={c.id} tono="alerta" titulo="Orden de compra por revisar">
          La reposición automática generó <strong>{c.numero}</strong>
          {c.items[0] && <> para <strong>{c.items[0].codigoRepuesto}</strong> × {c.items[0].cantidad}</>}.
          Revise la cantidad y envíela al proveedor. <Link to="/inventario">Ir a inventario</Link>
        </Aviso>
      ))}
      {porRecibir.map((c) => (
        <Aviso key={c.id} tono="info" titulo="Mercancía por recibir">
          La orden de compra <strong>{c.numero}</strong> fue enviada al proveedor.
          Cuando llegue, registre la recepción para sumar el stock. <Link to="/inventario">Ir a inventario</Link>
        </Aviso>
      ))}

      <div className="fila" style={{ marginBottom: 14 }}>
        <input
          placeholder="Buscar por placa, cliente u orden"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar órdenes"
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as Filtro)}
          aria-label="Filtrar por estado"
          style={{ maxWidth: 220 }}
        >
          <option value="TODOS">Todas en el taller</option>
          <option value="ACTIVAS">Activas (en trabajo)</option>
          <option value="POR_ENTREGAR">Por entregar</option>
          <optgroup label="Por estado">
            {VIGILADOS.map((e) => <option key={e} value={e}>{etiquetaEstado(e)}</option>)}
          </optgroup>
        </select>
      </div>

      {visibles.length === 0 ? (
        <Vacio>
          {lista.length === 0
            ? 'No hay vehículos en el taller. Cuando se reciba uno aparecerá aquí.'
            : 'Ninguna orden coincide con la búsqueda.'}
        </Vacio>
      ) : (
        <div className="tabla-desplazable">
        <table>
          <thead>
            <tr>
              <th>Orden</th><th>Vehículo</th><th>Cliente</th>
              <th>Estado</th><th>Mecánico</th><th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((o) => (
              <tr key={o.id} className="clicable" onClick={() => navegar(`/ordenes/${o.id}`)}>
                <td><strong>{o.numero ?? '—'}</strong></td>
                <td>{o.descripcionVehiculo} · {o.placa}</td>
                <td>{o.cliente ?? '—'}</td>
                <td><Estado valor={o.estado} /></td>
                <td className={o.mecanico ? '' : 'tenue'}>{o.mecanico ?? 'sin asignar'}</td>
                <td className="numero">{dinero(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <p className="tenue" style={{ marginTop: 14 }}>
        Mostrando {visibles.length} de {lista.length} órdenes en el taller:
        {' '}{activas} {activas === 1 ? 'activa' : 'activas'} y {porEntregar} por entregar.
      </p>
    </>
  )
}

function Indicador(
  { rotulo, valor, tono = '' }: { rotulo: string; valor: number | string; tono?: string },
) {
  return (
    <div className={`indicador ${tono}`}>
      <div className="rotulo">{rotulo}</div>
      <div className="cifra">{valor}</div>
    </div>
  )
}
