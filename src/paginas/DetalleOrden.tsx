import { ETIQUETA_COTIZACION } from '../estados'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { EstadoOrden } from '../api/tipos'
import { useAutenticacion } from '../autenticacion/Contexto'
import { inicioDe } from '../autenticacion/inicio'
import { ordenes, personal } from '../api/servicios'
import type { Mecanico, OrdenDetalle as Orden } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { Cargando } from '../componentes/Cargando'
import { LineaTiempo } from '../componentes/LineaTiempo'
import { dinero, fechaHora } from '../formato'

/**
 * Estados en los que la recepcion no tiene nada que hacer, y quien debe dar
 * el siguiente paso. Mostrarlo evita un recuadro de acciones vacio.
 */
const SIGUIENTE_PASO: Partial<Record<EstadoOrden, string>> = {
  EN_REPARACION: 'El mecánico asignado debe cerrar la orden cuando termine el trabajo, '
    + 'o marcarla en espera de repuesto si le falta alguno.',
  CERRADA: 'La factura se genera automáticamente al cerrar la orden; en unos momentos '
    + 'pasará a «Facturada» y podrá registrar la entrega.',
  ENTREGADA: 'La orden fue entregada al cliente y quedó en solo lectura.',
}

export function DetalleOrden() {
  const { id = '' } = useParams()
  const { sesion } = useAutenticacion()
  const navegar = useNavigate()
  const [orden, setOrden] = useState<Orden | null>(null)
  const [mecanicos, setMecanicos] = useState<Mecanico[]>([])
  const [mecanicoElegido, setMecanicoElegido] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [ocupado, setOcupado] = useState(false)

  const recargar = useCallback(() => {
    ordenes.detalle(id).then(setOrden).catch(setError)
  }, [id])

  useEffect(() => { recargar() }, [recargar])
  useEffect(() => { personal.disponibles().then(setMecanicos).catch(() => setMecanicos([])) }, [orden?.estado])

  async function ejecutar(accion: () => Promise<Orden>) {
    setOcupado(true)
    setError(null)
    try {
      setOrden(await accion())
    } catch (e) {
      setError(e)
      // Si la operacion fallo, el estado real puede haber cambiado igual
      // (por ejemplo, quedar en espera de repuesto). Se vuelve a leer.
      recargar()
    } finally {
      setOcupado(false)
    }
  }

  if (!orden) {
    if (!error) return <Cargando que="la orden" />
    return (
      <>
        <AvisoError error={error} />
        <Link to={inicioDe(sesion?.rol)} className="boton-enlace primario">Volver al tablero</Link>
      </>
    )
  }

  const e = orden.estado

  return (
    <>
      <div className="encabezado">
        <div>
          <button className="secundario" onClick={() => navegar('/recepcion')}>← Tablero</button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <h2 style={{ margin: 0 }}>{orden.numero ?? 'Orden'}</h2>
          <Estado valor={e} />
        </div>
      </div>

      <p className="tenue">
        {orden.descripcionVehiculo} · {orden.placa} · ingreso {fechaHora(orden.fechaIngreso)} ·
        {' '}{orden.kilometrajeIngreso.toLocaleString('es-CO')} km · Cliente: {orden.cliente}
      </p>

      <AvisoError error={error} />

      <LineaTiempo historial={orden.historial} actual={e} />

      {orden.codigosFalla.length > 0 && (
        <div className="panel">
          <h3>Diagnóstico OBD-II</h3>
          <div className="codigos">{orden.codigosFalla.join(' · ')}</div>
        </div>
      )}

      <div className="panel">
        <h3>Servicios y repuestos</h3>
        {orden.servicios.length === 0 && orden.repuestos.length === 0 ? (
          <p className="tenue">Todavía no se ha agregado ningún ítem.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Código</th><th>Descripción</th><th>Cant.</th>
                <th style={{ textAlign: 'right' }}>Valor</th></tr>
            </thead>
            <tbody>
              {[...orden.servicios, ...orden.repuestos].map((i, n) => (
                <tr key={`${i.codigo}-${n}`}>
                  <td className="codigos">{i.codigo}</td>
                  <td>{i.descripcion}</td>
                  <td>{i.cantidad}</td>
                  <td className="numero">{dinero(i.valor)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}><strong>Total</strong></td>
                <td className="numero"><strong>{dinero(orden.total)}</strong></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {orden.numeroCotizacion && (
        <Aviso tono={orden.estadoCotizacion === 'APROBADA' ? 'exito' : 'info'}>
          Cotización <strong>{orden.numeroCotizacion}</strong>
          {orden.estadoCotizacion && <> · {ETIQUETA_COTIZACION[orden.estadoCotizacion] ?? orden.estadoCotizacion}</>}
        </Aviso>
      )}

      <div className="panel">
        <h3>Acciones disponibles</h3>
        {SIGUIENTE_PASO[e] ? (
          <>
            <p style={{ margin: '0 0 4px' }}>No hay acciones disponibles para su rol en este estado.</p>
            <p className="tenue" style={{ margin: 0 }}>{SIGUIENTE_PASO[e]}</p>
          </>
        ) : (
        <div className="acciones">
          {e === 'RECIBIDA' && (
            <button className="primario" disabled={ocupado} onClick={() => ejecutar(() =>
              ordenes.registrarDiagnostico(orden.id,
                { usarEscaner: true, codigosFalla: [], observaciones: 'Diagnóstico inicial' }))}>
              Iniciar diagnóstico
            </button>
          )}

          {e === 'EN_DIAGNOSTICO' && (
            <button className="primario" disabled={ocupado} onClick={() =>
              ejecutar(() => ordenes.transicionar(orden.id, 'COTIZADA'))}>
              Emitir cotización
            </button>
          )}

          {e === 'COTIZADA' && (
            <>
              <button className="exito" disabled={ocupado} onClick={() =>
                ejecutar(() => ordenes.transicionar(orden.id, 'APROBADA', { canal: 'PRESENCIAL' }))}>
                Registrar aprobación
              </button>
              <button className="peligro" disabled={ocupado} onClick={() =>
                ejecutar(() => ordenes.transicionar(orden.id, 'RECHAZADA',
                  { motivo: 'Rechazada por el cliente' }))}>
                Registrar rechazo
              </button>
            </>
          )}

          {e === 'APROBADA' && (
            <>
              <select value={mecanicoElegido} onChange={(ev) => setMecanicoElegido(ev.target.value)}
                      style={{ maxWidth: 230 }} aria-label="Mecánico">
                <option value="">Elegir mecánico…</option>
                {mecanicos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre} · {m.especialidad}</option>
                ))}
              </select>
              <button className="primario" disabled={ocupado || !mecanicoElegido} onClick={() =>
                ejecutar(() => ordenes.transicionar(orden.id, 'EN_REPARACION',
                  { idMecanico: mecanicoElegido }))}>
                Asignar y comenzar
              </button>
              {mecanicos.length === 0 && (
                <span className="tenue">No hay mecánicos disponibles en este momento.</span>
              )}
            </>
          )}

          {e === 'EN_ESPERA_REPUESTO' && (
            <button className="primario" disabled={ocupado} onClick={() =>
              ejecutar(() => ordenes.transicionar(orden.id, 'EN_ESPERA_REPUESTO'))}>
              Reanudar reparación
            </button>
          )}

          {(e === 'FACTURADA' || e === 'RECHAZADA') && (
            <button className="exito" disabled={ocupado} onClick={() =>
              ejecutar(() => ordenes.transicionar(orden.id, 'ENTREGADA'))}>
              Registrar entrega
            </button>
          )}

        </div>
        )}
      </div>
    </>
  )
}
