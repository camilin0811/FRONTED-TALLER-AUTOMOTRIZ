/*
 * Para qué sirve: Detalle de una orden para recepción: datos, historial y las acciones que permite
 * su estado.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ordenes, personal } from '../api/servicios'
import type { EstadoOrden, Hito, MecanicoAsignable, OrdenDetalle as Orden } from '../api/tipos'
import { useAutenticacion } from '../autenticacion/Contexto'
import { inicioDe } from '../autenticacion/inicio'
import { Aviso, AvisoError } from '../componentes/Aviso'
import { Cargando } from '../componentes/Cargando'
import { Estado } from '../componentes/Estado'
import { LineaTiempo } from '../componentes/LineaTiempo'
import { useAccionConfirmada } from '../componentes/interaccion'
import { ETIQUETA_COTIZACION, ETIQUETA_ROL, EN_PROCESO, etiquetaEstado } from '../estados'
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

/** Una accion que cambia el estado: que dice el boton y que confirma. */
interface Accion {
  etiqueta: string
  clase: string
  titulo: string
  mensaje: string
  exito: string
  peligro?: boolean
  /** Si se indica, el boton queda deshabilitado y este texto explica por que. */
  bloqueo?: string
  ejecutar: (id: string) => Promise<Orden>
}

function accionesDe(estado: EstadoOrden, idMecanico: string | null | undefined, servicios: number): Accion[] {
  switch (estado) {
    case 'RECIBIDA':
      return [{
        etiqueta: 'Iniciar diagnóstico', clase: 'primario', titulo: 'Iniciar diagnóstico',
        mensaje: 'La orden pasará a «En diagnóstico» y se intentará leer el escáner OBD-II.',
        exito: 'Diagnóstico iniciado.',
        ejecutar: (id) => ordenes.registrarDiagnostico(id,
          { usarEscaner: true, codigosFalla: [], observaciones: 'Diagnóstico inicial' }),
      }]
    case 'EN_DIAGNOSTICO':
      return [{
        etiqueta: 'Emitir cotización', clase: 'primario', titulo: 'Emitir cotización',
        mensaje: 'Se emitirá la cotización con los servicios y repuestos registrados y se enviará al cliente. '
          + 'La orden pasará a «Cotizada».',
        exito: 'Cotización emitida.',
        // El backend tambien lo valida; aqui se avisa antes de intentarlo.
        bloqueo: servicios === 0 ? 'Agregue al menos un servicio para emitir la cotización.' : undefined,
        ejecutar: (id) => ordenes.transicionar(id, 'COTIZADA'),
      }]
    case 'COTIZADA':
      return [{
        etiqueta: 'Registrar aprobación', clase: 'exito', titulo: 'Registrar aprobación del cliente',
        mensaje: 'El cliente aprobó la cotización en el mostrador. La orden pasará a «Aprobada».',
        exito: 'Aprobación registrada.',
        ejecutar: (id) => ordenes.transicionar(id, 'APROBADA', { canal: 'PRESENCIAL' }),
      }, {
        etiqueta: 'Registrar rechazo', clase: 'peligro', titulo: 'Registrar rechazo del cliente', peligro: true,
        mensaje: 'El cliente rechazó la cotización. La orden pasará a «Rechazada» y no se hará el trabajo.',
        exito: 'Rechazo registrado.',
        ejecutar: (id) => ordenes.transicionar(id, 'RECHAZADA', { motivo: 'Rechazada por el cliente' }),
      }]
    case 'APROBADA':
      return idMecanico ? [{
        etiqueta: 'Comenzar reparación', clase: 'primario', titulo: 'Comenzar reparación',
        mensaje: 'La orden pasará a «En reparación» con el mecánico asignado.',
        exito: 'Reparación iniciada.',
        ejecutar: (id) => ordenes.transicionar(id, 'EN_REPARACION'),
      }] : []
    case 'EN_ESPERA_REPUESTO':
      return [{
        etiqueta: 'Reanudar reparación', clase: 'primario', titulo: 'Reanudar reparación',
        mensaje: 'Confirme que el repuesto ya llegó. La orden volverá a «En reparación».',
        exito: 'Reparación reanudada.',
        ejecutar: (id) => ordenes.transicionar(id, 'EN_REPARACION'),
      }]
    case 'FACTURADA':
    case 'RECHAZADA':
      return [{
        etiqueta: 'Registrar entrega', clase: 'exito', titulo: 'Registrar entrega',
        mensaje: 'El cliente retiró el vehículo. La orden pasará a «Entregada» y quedará en solo lectura.',
        exito: 'Entrega registrada.',
        ejecutar: (id) => ordenes.transicionar(id, 'ENTREGADA'),
      }]
    default:
      return []
  }
}

export function DetalleOrden() {
  const { id = '' } = useParams()
  const { sesion, tieneRol } = useAutenticacion()
  const navegar = useNavigate()
  const ejecutarConfirmado = useAccionConfirmada()
  const [orden, setOrden] = useState<Orden | null>(null)
  const [historial, setHistorial] = useState<Hito[]>([])
  const [mecanicos, setMecanicos] = useState<MecanicoAsignable[]>([])
  const [mecanicoElegido, setMecanicoElegido] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [ocupado, setOcupado] = useState(false)

  const puedeAsignar = tieneRol('RECEPCIONISTA', 'ADMINISTRADOR')

  const recargar = useCallback(() => {
    ordenes.detalle(id).then(setOrden).catch(setError)
    ordenes.historial(id).then(setHistorial).catch(() => setHistorial([]))
  }, [id])

  useEffect(() => { recargar() }, [recargar])
  useEffect(() => {
    if (puedeAsignar) personal.asignables().then(setMecanicos).catch(() => setMecanicos([]))
  }, [orden?.idMecanico, puedeAsignar])

  async function cambiarEstado(accion: Accion) {
    if (!orden) return
    const actualizada = await ejecutarConfirmado(
      { titulo: accion.titulo, mensaje: accion.mensaje, confirmar: accion.etiqueta,
        exito: accion.exito, peligro: accion.peligro, alConfirmar: () => setOcupado(true) },
      () => accion.ejecutar(orden.id),
    )
    setOcupado(false)
    // Exito o fallo, se vuelve a leer: un fallo tambien puede haber cambiado
    // el estado real (por ejemplo, quedar en espera de repuesto).
    if (actualizada) setOrden(actualizada)
    recargar()
  }

  async function asignarMecanico() {
    if (!orden || !mecanicoElegido) return
    const elegido = mecanicos.find((m) => m.idMecanico === mecanicoElegido)
    const actualizada = await ejecutarConfirmado({
      titulo: orden.mecanico ? 'Cambiar mecánico' : 'Asignar mecánico',
      mensaje: orden.mecanico
        ? <>La orden <span className="nowrap">{orden.numero}</span> pasará de {orden.mecanico} a {elegido?.nombre}.
            {' '}{orden.mecanico} quedará disponible.</>
        : <>{elegido?.nombre} quedará a cargo de la orden <span className="nowrap">{orden.numero}</span>.</>,
      confirmar: orden.mecanico ? 'Cambiar mecánico' : 'Asignar',
      exito: `Mecánico asignado: ${elegido?.nombre}.`,
      alConfirmar: () => setOcupado(true),
    }, () => ordenes.asignarMecanico(orden.id, mecanicoElegido))
    setOcupado(false)
    if (actualizada) {
      setOrden(actualizada)
      setMecanicoElegido('')
      // La asignacion queda en el historial: se vuelve a leer.
      ordenes.historial(actualizada.id).then(setHistorial).catch(() => {})
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
  const acciones = accionesDe(e, orden.idMecanico, orden.servicios.length)
  const enTrabajo = EN_PROCESO.includes(e)
  const opciones = mecanicos.filter((m) => m.idMecanico !== orden.idMecanico)

  return (
    <>
      <div className="encabezado">
        <div>
          <button className="secundario" onClick={() => navegar('/recepcion')}>← Tablero</button>
        </div>
        <div className="titulo-orden">
          <h2 style={{ margin: 0 }}>{orden.numero ?? 'Orden'}</h2>
          <Estado valor={e} />
        </div>
      </div>

      <p className="tenue">
        {orden.descripcionVehiculo} · {orden.placa} · ingreso {fechaHora(orden.fechaIngreso)} ·
        {' '}{orden.kilometrajeIngreso.toLocaleString('es-CO')} km · Cliente: {orden.cliente}
      </p>

      {orden.motivoIngreso && (
        <div className="panel">
          <h3>Motivo de ingreso</h3>
          <p style={{ margin: 0 }}>{orden.motivoIngreso}</p>
        </div>
      )}

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
          <div className="tabla-desplazable">
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
          </div>
        )}
      </div>

      {orden.numeroCotizacion && (
        <Aviso tono={orden.estadoCotizacion === 'APROBADA' ? 'exito' : 'info'}>
          Cotización <strong>{orden.numeroCotizacion}</strong>
          {orden.estadoCotizacion && <> · {ETIQUETA_COTIZACION[orden.estadoCotizacion] ?? orden.estadoCotizacion}</>}
        </Aviso>
      )}

      {/* ------------------------------------------------------- mecanico */}
      <div className="panel">
        <h3>Mecánico</h3>
        <p style={{ margin: '0 0 10px' }}>
          {orden.mecanico ? <strong>{orden.mecanico}</strong> : <span className="tenue">Sin asignar</span>}
        </p>
        {puedeAsignar && enTrabajo && (
          <div className="acciones" style={{ marginTop: 0 }}>
            <select value={mecanicoElegido} onChange={(ev) => setMecanicoElegido(ev.target.value)}
                    aria-label={orden.mecanico ? 'Cambiar mecánico' : 'Asignar mecánico'} className="selector-mecanico">
              <option value="">{orden.mecanico ? 'Cambiar a…' : 'Elegir mecánico…'}</option>
              {opciones.map((m) => (
                <option key={m.idMecanico} value={m.idMecanico} disabled={!m.disponible}>
                  {m.nombre}{m.especialidad ? ` · ${m.especialidad}` : ''}{m.disponible ? '' : ' · ocupado'}
                </option>
              ))}
            </select>
            <button className="primario" disabled={ocupado || !mecanicoElegido} onClick={asignarMecanico}>
              {orden.mecanico ? 'Cambiar' : 'Asignar'}
            </button>
          </div>
        )}
        {puedeAsignar && enTrabajo && opciones.length > 0 && opciones.every((m) => !m.disponible) && (
          <p className="tenue" style={{ margin: '8px 0 0' }}>Todos los demás mecánicos están ocupados en este momento.</p>
        )}
      </div>

      {/* ------------------------------------------------------- acciones */}
      <div className="panel">
        <h3>Acciones disponibles</h3>
        {SIGUIENTE_PASO[e] ? (
          <>
            <p style={{ margin: '0 0 4px' }}>No hay acciones disponibles para su rol en este estado.</p>
            <p className="tenue" style={{ margin: 0 }}>{SIGUIENTE_PASO[e]}</p>
          </>
        ) : acciones.length === 0 ? (
          <p className="tenue" style={{ margin: 0 }}>
            {e === 'APROBADA'
              ? 'Asigne un mecánico arriba para poder comenzar la reparación.'
              : 'No hay acciones disponibles para su rol en este estado.'}
          </p>
        ) : (
          <>
            <div className="acciones">
              {acciones.map((a, i) => (
                <button key={a.etiqueta} className={a.clase} disabled={ocupado || Boolean(a.bloqueo)}
                        aria-describedby={a.bloqueo ? `bloqueo-${i}` : undefined}
                        onClick={() => cambiarEstado(a)}>
                  {a.etiqueta}
                </button>
              ))}
            </div>
            {acciones.map((a, i) => a.bloqueo && (
              <p key={`bloqueo-${i}`} id={`bloqueo-${i}`} className="aviso-bloqueo">{a.bloqueo}</p>
            ))}
          </>
        )}
      </div>

      {/* ------------------------------------------------------ historial */}
      <div className="panel">
        <h3>Historial</h3>
        {historial.length === 0 ? (
          <p className="tenue" style={{ margin: 0 }}>Sin cambios registrados.</p>
        ) : (
          <ol className="historial">
            {[...historial].reverse().map((h, i) => (
              <li key={`${h.tipo}-${h.fecha}-${i}`} className={h.tipo === 'MECANICO' ? 'anotacion' : undefined}>
                <div className="historial-estado">
                  {h.tipo === 'MECANICO' ? h.descripcion : h.estado ? etiquetaEstado(h.estado) : '—'}
                </div>
                <div className="historial-quien">
                  {h.nombre ?? 'Sistema'}
                  {h.rol && <span className="tenue"> · {ETIQUETA_ROL[h.rol]}</span>}
                </div>
                <time className="historial-cuando tenue" dateTime={h.fecha}>{fechaHora(h.fecha)}</time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}
