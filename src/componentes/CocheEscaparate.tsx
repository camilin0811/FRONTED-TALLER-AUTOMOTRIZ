import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Escaparate del auto 3D. Decide ANTES de descargar nada:
 *
 * - Sin WebGL -> fondo estatico de pista y ni un byte de three.js.
 * - Fuera de la vista -> no se descarga: la escena (codigo y modelo) viaja la
 *   primera vez que la vitrina entra en pantalla. En el portal, que la oculta
 *   en el celular, nunca se descarga.
 * - A la vista -> carga diferida; mientras baja el modelo se ve el fondo
 *   estatico, que se desvanece cuando el auto esta listo.
 * - prefers-reduced-motion -> la escena se muestra, pero el auto no gira.
 *
 * Una vez montada, la escena se pausa cuando sale de la pantalla o la pestana
 * queda oculta: no tiene sentido gastar GPU en algo que nadie ve.
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

export function CocheEscaparate({ className }: { className?: string }) {
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

  const alCargar = useCallback(() => setCargado(true), [])

  return (
    <div className={`escaparate ${className ?? ''}`} ref={caja} aria-hidden>
      {soportado && visto && (
        <Suspense fallback={null}>
          <Coche3D animado={animado} activo={enPantalla && pestanaVisible} alCargar={alCargar} />
        </Suspense>
      )}
      {/* El fondo estatico cubre la espera y se desvanece con el auto listo. */}
      <div className={`coche-fallback escaparate-espera ${cargado ? 'oculto' : ''}`} />
    </div>
  )
}
