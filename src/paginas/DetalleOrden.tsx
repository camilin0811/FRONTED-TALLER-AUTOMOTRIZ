import { etiquetaEstado } from '../estados'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ordenes, personal } from '../api/servicios'
import type { Mecanico, OrdenDetalle as Orden } from '../api/tipos'
import { Estado } from '../componentes/Estado'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { Cargando } from '../componentes/Cargando'
import { LineaTiempo } from '../componentes/LineaTiempo'
import { dinero, fechaHora } from '../formato'

export function DetalleOrden() {
  const { id = '' } = useParams()
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

  if (!orden) return error ? <AvisoError error={error} /> : <Cargando que="la orden" />

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
        {' '}{orden.kilometrajeIngreso.toLocaleString('es-CO')} km · cliente {orden.cliente}
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
          Cotización <strong>{orden.numeroCotizacion}</strong> · {orden.estadoCotizacion}
        </Aviso>
      )}

      <div className="panel">
        <h3>Acciones disponibles</h3>
        <p className="tenue" style={{ marginTop: -6 }}>
          Solo se muestran las transiciones que la máquina de estados permite desde «{etiquetaEstado(e)}».
        </p>
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

          {e === 'CERRADA' && (
            <Aviso tono="info">
              La facturación ante la DIAN se dispara sola al cerrar la orden. Si tarda,
              revise las facturas pendientes de envío.
            </Aviso>
          )}

          {(e === 'FACTURADA' || e === 'RECHAZADA') && (
            <button className="exito" disabled={ocupado} onClick={() =>
              ejecutar(() => ordenes.transicionar(orden.id, 'ENTREGADA'))}>
              Registrar entrega
            </button>
          )}

          {e === 'ENTREGADA' && (
            <Aviso tono="exito">Orden entregada. Queda en solo lectura.</Aviso>
          )}
        </div>
      </div>
    </>
  )
}
