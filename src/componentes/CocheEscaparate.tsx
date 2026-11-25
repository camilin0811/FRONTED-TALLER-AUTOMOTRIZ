import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ZONAS, servicio, type IdZona } from '../servicios'
import type { Modo, PuntoEnPantalla, Reserva, SenalAcceso } from './Coche3D'

export type { EstadoAcceso, SenalAcceso } from './Coche3D'

const MODOS: { id: Modo; nombre: string }[] = [
  { id: 'real', nombre: 'Real' },
  { id: 'escaner', nombre: 'Escáner' },
  { id: 'plano', nombre: 'Plano' },
]
const SIN_RESERVA: Reserva = { izquierda: 0, abajo: 0 }

/**
 * Escaparate del auto 3D. Decide ANTES de descargar nada:
 *
 * - Sin WebGL -> fondo estatico de pista y ni un byte de three.js.
 * - Fuera de la vista -> no se descarga: la escena (codigo y modelo) viaja la
 *   primera vez que la vitrina entra en pantalla. En el portal, que la oculta
 *   en el celular, nunca se descarga.
 * - A la vista -> carga diferida; mientras baja el modelo se ve el fondo
 *   estatico, que se desvanece cuando el auto esta listo.
 * - prefers-reduced-motion -> sin giro automatico, sin parallax y la camara
 *   salta a cada zona en lugar de volar.
 *
 * Con `interactivo`, ademas, muestra el selector de modo (Real, Escaner,
 * Plano), la tarjeta HUD de la zona elegida y la linea que la une con su
 * punto en el auto. La tarjeta va a un costado en escritorio y debajo en el
 * celular, siempre dentro de la vitrina, y la escena se corre para que el
 * auto quede en el espacio libre.
 */
const Coche3D = lazy(() => import('./Coche3D'))

function hayWebGL(): boolean {
  try {
    const lienzo = document.createElement('canvas')
    return Boolean(lienzo.getContext('webgl2') ?? lienzo.getContext('webgl'))
  } catch {
    return false
  }
}

export function CocheEscaparate({ className, interactivo = false, acceso }: {
  className?: string
  interactivo?: boolean
  /** Estado del formulario de acceso: el auto enciende luces, hace "rev", etc. */
  acceso?: SenalAcceso
}) {
  // Se evalua una sola vez por montaje: ni el soporte de WebGL ni la
  // preferencia de movimiento cambian mientras la pagina esta abierta.
  const soportado = useMemo(() => hayWebGL(), [])
  const animado = useMemo(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const caja = useRef<HTMLDivElement>(null)
  const [visto, setVisto] = useState(false)
  const [enPantalla, setEnPantalla] = useState(false)
  const [pestanaVisible, setPestanaVisible] = useState(() => document.visibilityState === 'visible')
  const [cargado, setCargado] = useState(false)
  const [zona, setZona] = useState<IdZona | null>(null)
  const [zoom, setZoom] = useState(false)
  const [modo, setModo] = useState<Modo>('real')
  const [reserva, setReserva] = useState<Reserva>(SIN_RESERVA)

  useEffect(() => {
    const el = caja.current
    if (!el || !soportado) return
    const observador = new IntersectionObserver(([entrada]) => {
      setEnPantalla(entrada.isIntersecting)
      if (entrada.isIntersecting) setVisto(true)
    }, { rootMargin: '120px' })
    observador.observe(el)
    const alCambiarPestana = () => setPestanaVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', alCambiarPestana)
    return () => {
      observador.disconnect()
      document.removeEventListener('visibilitychange', alCambiarPestana)
    }
  }, [soportado])

  // Esc cierra la tarjeta y vuelve a la vista general.
  useEffect(() => {
    if (!zona) return
    const teclado = (e: KeyboardEvent) => { if (e.key === 'Escape') setZona(null) }
    document.addEventListener('keydown', teclado)
    return () => document.removeEventListener('keydown', teclado)
  }, [zona])

  const alCargar = useCallback(() => setCargado(true), [])

  // La linea se actualiza en cada cuadro directamente sobre el SVG: pasar por
  // el estado de React volveria a renderizar la vitrina sesenta veces por segundo.
  const linea = useRef<SVGLineElement>(null)
  const extremo = useRef<SVGCircleElement>(null)
  const tarjeta = useRef<HTMLDivElement>(null)
  const alProyectar = useCallback((p: PuntoEnPantalla) => {
    const l = linea.current; const c = extremo.current; const t = tarjeta.current; const contenedor = caja.current
    if (!l || !c || !t || !contenedor) return
    const rc = contenedor.getBoundingClientRect(); const rt = t.getBoundingClientRect()
    // Sale del punto del borde de la tarjeta mas cercano al punto del auto.
    const izquierda = rt.left - rc.left; const derecha = rt.right - rc.left
    const arriba = rt.top - rc.top; const abajo = rt.bottom - rc.top
    const x1 = Math.min(Math.max(p.x, izquierda), derecha)
    const y1 = Math.min(Math.max(p.y, arriba), abajo)
    // Si el punto quedara debajo de la tarjeta, la linea no tendria sentido.
    const tapado = p.x > izquierda && p.x < derecha && p.y > arriba && p.y < abajo
    l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1))
    l.setAttribute('x2', String(p.x)); l.setAttribute('y2', String(p.y))
    c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y))
    const opacidad = p.visible && !tapado ? '1' : '0'
    l.style.opacity = opacidad; c.style.opacity = opacidad
  }, [])

  // Cuanto tapa la tarjeta, para que la escena se corra y el auto quede en el
  // espacio libre: a la izquierda en escritorio, abajo en el celular.
  useLayoutEffect(() => {
    const medir = () => {
      const t = tarjeta.current; const c = caja.current
      if (!zona || !t || !c) { setReserva(SIN_RESERVA); return }
      const rc = c.getBoundingClientRect(); const rt = t.getBoundingClientRect()
      const abajo = rt.width > rc.width * 0.6
      setReserva(abajo
        ? { izquierda: 0, abajo: Math.round(rc.bottom - rt.top + 8) }
        : { izquierda: Math.round(rt.right - rc.left + 12), abajo: 0 })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [zona])

  const datos = zona ? ZONAS.find((z) => z.id === zona) : null
  const srv = datos ? servicio(datos.servicio) : null

  return (
    <div
      className={`escaparate modo-${modo} ${interactivo ? 'interactivo' : ''} ${zona ? 'con-zona' : ''} ${className ?? ''}`}
      ref={caja}
      // La rueda del raton hace zoom solo despues de tocar el auto: si no, al
      // pasar por encima con la rueda la pagina dejaria de desplazarse.
      onPointerDown={() => setZoom(true)}
      onPointerLeave={() => setZoom(false)}
    >
      {soportado && visto && (
        <Suspense fallback={null}>
          <Coche3D
            animado={animado} activo={enPantalla && pestanaVisible} alCargar={alCargar}
            interactivo={interactivo} zoomHabilitado={zoom}
            modo={modo} zonaActiva={zona} reserva={reserva} acceso={acceso}
            alElegirZona={setZona} alProyectar={alProyectar}
          />
        </Suspense>
      )}
      {/* El fondo estatico cubre la espera y se desvanece con el auto listo. */}
      <div className={`coche-fallback escaparate-espera ${cargado ? 'oculto' : ''}`} aria-hidden />

      {interactivo && cargado && (
        <div className="selector-modo" role="radiogroup" aria-label="Modo de vista del auto">
          {MODOS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={modo === m.id}
                    className={modo === m.id ? 'activo' : ''} onClick={() => setModo(m.id)}>
              {m.nombre}
            </button>
          ))}
        </div>
      )}

      {interactivo && cargado && !zona && (
        <p className="escaparate-ayuda" aria-hidden>
          {modo === 'plano' ? 'Toque un punto para ver el servicio' : 'Arrastre para girar · toque un punto'}
        </p>
      )}
      {interactivo && cargado && modo === 'escaner' && !zona && (
        <div className="escaner-estado" aria-hidden><span className="escaner-led" />Escáner OBD-II · en línea</div>
      )}
      {interactivo && cargado && modo === 'plano' && !zona && (
        <div className="plano-rotulo" aria-hidden>
          <strong>Plano técnico</strong>
          <span>Vista lateral izquierda · cotas en mm</span>
        </div>
      )}

      {interactivo && datos && srv && (
        <>
          <svg className="hud-linea" aria-hidden>
            <line ref={linea} x1="0" y1="0" x2="0" y2="0" />
            <circle ref={extremo} r="3" cx="0" cy="0" />
          </svg>
          <div className="hud-tarjeta" ref={tarjeta} role="region" aria-live="polite"
               aria-label={`Zona: ${datos.nombre}`}>
            <div className="hud-zona">{datos.nombre}</div>
            <div className="hud-servicio">{srv.titulo}</div>
            <p className="hud-texto">{srv.texto}</p>
            <div className="hud-dato">{datos.dato}</div>
            <button type="button" className="hud-volver" onClick={() => setZona(null)}>← Volver</button>
          </div>
        </>
      )}
    </div>
  )
}
