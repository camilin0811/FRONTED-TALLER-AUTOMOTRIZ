import { Suspense, lazy, useMemo } from 'react'

/**
 * Escaparate del coche 3D. Decide ANTES de descargar nada:
 *
 * - Sin WebGL -> fondo estatico de pista y ni un byte de three.js.
 * - Con WebGL -> carga diferida de la escena; mientras baja, el mismo fondo.
 * - prefers-reduced-motion -> la escena se muestra, pero el coche no gira.
 *
 * La division importa: three.js pesa mas que el resto de la aplicacion
 * junta, asi que vive en su propio trozo y solo viaja a quien lo va a ver.
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

  return (
    <div className={className} aria-hidden>
      {soportado ? (
        <Suspense fallback={<div className="coche-fallback" />}>
          <Coche3D animado={animado} />
        </Suspense>
      ) : (
        <div className="coche-fallback" />
      )}
    </div>
  )
}
