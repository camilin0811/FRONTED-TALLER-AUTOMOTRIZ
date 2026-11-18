import { etiquetaEstado } from '../estados'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { inventario, ordenes } from '../api/servicios'
import type { OrdenCompra, OrdenResumen, EstadoOrden } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { Cargando, Vacio } from '../componentes/Cargando'
import { dinero, fecha } from '../formato'

/** Estados que el tablero vigila a diario. */
const VIGILADOS: EstadoOrden[] = [
  'RECIBIDA', 'EN_DIAGNOSTICO', 'COTIZADA', 'APROBADA',
  'EN_REPARACION', 'EN_ESPERA_REPUESTO', 'CERRADA', 'FACTURADA',
]

export function PanelRecepcion() {
  const navegar = useNavigate()
  const [lista, setLista] = useState<OrdenResumen[]>([])
  const [compras, setCompras] = useState<OrdenCompra[]>([])
  const [filtro, setFiltro] = useState<EstadoOrden | 'TODOS'>('TODOS')
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
      .filter((o) => filtro === 'TODOS' || o.estado === filtro)
      .filter((o) => !texto
        || o.placa?.toUpperCase().includes(texto)
        || o.numero?.toUpperCase().includes(texto)
        || o.cliente?.toUpperCase().includes(texto))
      .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso))
  }, [lista, filtro, busqueda])

  const enProceso = lista.filter((o) => ['EN_REPARACION', 'EN_DIAGNOSTICO', 'RECIBIDA'].includes(o.estado)).length
  const esperanAprobacion = lista.filter((o) => o.estado === 'COTIZADA').length
  const sinRepuesto = lista.filter((o) => o.estado === 'EN_ESPERA_REPUESTO').length
  const facturado = lista.filter((o) => ['FACTURADA'].includes(o.estado))
    .reduce((suma, o) => suma + (o.total ?? 0), 0)
  const comprasPendientes = compras.filter((c) => c.estado === 'BORRADOR')

  if (cargando) return <Cargando que="el tablero" />

  return (
    <>
      <div className="encabezado">
        <h2>Tablero de órdenes</h2>
        <span className="tenue">{fecha(new Date().toISOString())}</span>
      </div>

      <AvisoError error={error} />

      <div className="indicadores">
        <Indicador rotulo="En proceso" valor={enProceso} />
        <Indicador rotulo="Esperan aprobación" valor={esperanAprobacion} tono="aviso" />
        <Indicador rotulo="Sin repuesto" valor={sinRepuesto} tono="error" />
        <Indicador rotulo="Facturado" valor={dinero(facturado)} tono="ok" />
      </div>

      {comprasPendientes.map((c) => (
        <Aviso key={c.id} tono="alerta" titulo="Reposición automática generada">
          La orden de compra <strong>{c.numero}</strong> quedó en borrador
          {c.items[0] && <> para <strong>{c.items[0].codigoRepuesto}</strong> × {c.items[0].cantidad}</>}.
          Requiere revisión antes de enviarse al proveedor.
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
          onChange={(e) => setFiltro(e.target.value as EstadoOrden | 'TODOS')}
          aria-label="Filtrar por estado"
          style={{ maxWidth: 220 }}
        >
          <option value="TODOS">Estado: todos</option>
          {VIGILADOS.map((e) => <option key={e} value={e}>{etiquetaEstado(e)}</option>)}
        </select>
      </div>

      {visibles.length === 0 ? (
        <Vacio>
          {lista.length === 0
            ? 'No hay órdenes activas. Cuando se reciba un vehículo aparecerá aquí.'
            : 'Ninguna orden coincide con la búsqueda.'}
        </Vacio>
      ) : (
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
      )}

      <p className="tenue" style={{ marginTop: 14 }}>
        Mostrando {visibles.length} de {lista.length} órdenes activas
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
