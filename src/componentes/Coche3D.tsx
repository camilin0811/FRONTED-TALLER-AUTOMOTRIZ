import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  AdaptiveDpr, ContactShadows, Environment, Lightformer, MeshReflectorMaterial, PerformanceMonitor, useGLTF,
} from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Box3, Vector3 } from 'three'
import type { Group, Object3D } from 'three'

/**
 * Vitrina 3D del taller: el auto "Car Concept" (Eric Chadwick, CC BY 4.0,
 * creditos en public/models/CREDITS.md) en un estudio iluminado con paneles
 * de luz, sobre un piso reflectante.
 *
 * El modelo trae sus propios materiales fisicos (pintura con laca, vidrio
 * con transmision, caucho con relieve, rines metalicos) y se usan tal cual.
 * Todo se sirve desde /public: el modelo comprimido con Draco (1,5 MB) y el
 * decodificador. En tiempo de ejecucion no se toca ningun CDN.
 *
 * Este modulo solo se carga de forma diferida desde CocheEscaparate, que es
 * quien decide si hay WebGL, si el visitante tolera movimiento y si la
 * vitrina esta a la vista.
 */

const MODELO = '/models/concepto.glb'
const DRACO = '/draco/'

/** Distancia de la camara al centro: arranca lejos y se acerca al aparecer. */
const DISTANCIA_FINAL = 5.0
const DISTANCIA_INICIAL = 7.5
/** Proporcion ancho/alto para la que esta calibrada la distancia (el hero de escritorio). */
const ASPECTO_DE_REFERENCIA = 2

function Concepto({ animado, alCargar }: { animado: boolean; alCargar?: () => void }) {
  const gltf = useGLTF(MODELO, DRACO)
  const plato = useRef<Group>(null)
  const ruedas = useRef<Object3D[]>([])
  const distancia = useRef(animado ? DISTANCIA_INICIAL : DISTANCIA_FINAL)

  // Clon propio: el acceso y el portal no deben compartir transformaciones.
  const escena = useMemo(() => gltf.scene.clone(true), [gltf])

  useLayoutEffect(() => {
    // Escala conocida, centrado y ruedas sobre el piso: un cambio de modelo
    // no obliga a recalibrar la camara.
    escena.position.set(0, 0, 0)
    escena.scale.setScalar(1)
    const caja = new Box3().setFromObject(escena)
    const tamano = caja.getSize(new Vector3())
    escena.scale.setScalar(4.2 / Math.max(tamano.x, tamano.z))
    caja.setFromObject(escena)
    const centro = caja.getCenter(new Vector3())
    escena.position.set(-centro.x, -caja.min.y, -centro.z)

    // Cada rueda es un grupo con el pivote en el eje. Giran la llanta, el rin
    // y el disco; la mordaza del freno queda quieta, como en un auto real.
    ruedas.current = []
    escena.traverse((nodo) => {
      if (!/^Wheel(Front|Rear)(L|R)$/.test(nodo.name)) return
      for (const pieza of nodo.children) {
        if (!/BrakePad/.test(pieza.name)) ruedas.current.push(pieza)
      }
    })
    alCargar?.()
  }, [escena, alCargar])

  useFrame((estado, delta) => {
    const camara = estado.camera
    if (animado) {
      if (plato.current) plato.current.rotation.y += delta * 0.22
      for (const pieza of ruedas.current) pieza.rotation.x -= delta * 2.4
      // Entrada: la camara se acerca con suavidad hasta su distancia final.
      distancia.current += (DISTANCIA_FINAL - distancia.current) * Math.min(1, delta * 1.6)
    }
    // Encuadre de tres cuartos, con un leve seguimiento del cursor.
    const mx = animado ? estado.pointer.x * 0.45 : 0
    const my = animado ? estado.pointer.y * 0.25 : 0
    // El campo de vision es vertical: en un lienzo angosto (celular) el auto
    // se cortaria a los lados, asi que la camara se aleja en proporcion.
    const aspecto = estado.size.width / Math.max(1, estado.size.height)
    const d = distancia.current * Math.max(1, ASPECTO_DE_REFERENCIA / aspecto)
    camara.position.set(d * 0.68 + mx, 1.55 + my, d * 0.73)
    camara.lookAt(0, 0.55, 0)
  })

  return (
    <group ref={plato} rotation={[0, -0.6, 0]}>
      <primitive object={escena} />
    </group>
  )
}

/**
 * Estudio de fotografia de autos: franjas de luz cenitales que dibujan
 * reflejos largos sobre la carroceria, paneles laterales suaves y un contraluz
 * rojo que conecta con la paleta del sitio. No descarga nada: los paneles se
 * pintan en un mapa de entorno generado una sola vez (frames={1}).
 */
function Estudio() {
  return (
    <Environment resolution={256} frames={1}>
      {[-3, 0, 3].map((z) => (
        <Lightformer key={z} form="rect" intensity={2.2} color="#ffffff"
                     position={[0, 5, z]} rotation-x={Math.PI / 2} scale={[12, 0.9, 1]} />
      ))}
      <Lightformer form="rect" intensity={1.4} position={[-7, 1.5, 0]} rotation-y={Math.PI / 2} scale={[10, 2.2, 1]} />
      <Lightformer form="rect" intensity={1.4} position={[7, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[10, 2.2, 1]} />
      <Lightformer form="ring" intensity={1.6} color="#ff2d23" position={[0, 2, -9]} scale={4} />
      <Lightformer form="rect" intensity={0.6} color="#9fb6d0" position={[0, -1, 8]} scale={[12, 2, 1]} />
    </Environment>
  )
}

function Piso({ calidadAlta }: { calidadAlta: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
      <circleGeometry args={[9, 64]} />
      {calidadAlta ? (
        <MeshReflectorMaterial
          blur={[300, 90]} resolution={512} mixBlur={0.9} mixStrength={6} roughness={0.7}
          depthScale={1.1} minDepthThreshold={0.4} maxDepthThreshold={1.3}
          color="#0b0d11" metalness={0.5} mirror={0.5}
        />
      ) : (
        // En equipos lentos el reflejo (otra pasada completa de la escena)
        // se cambia por un piso mate.
        <meshStandardMaterial color="#0b0d11" roughness={0.85} metalness={0.2} />
      )}
    </mesh>
  )
}

export default function Coche3D({ animado, activo, alCargar }: {
  animado: boolean
  /** false cuando la vitrina no esta a la vista: el render se detiene. */
  activo: boolean
  alCargar?: () => void
}) {
  const [calidadAlta, setCalidadAlta] = useState(true)

  return (
    <Canvas
      frameloop={activo ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [5, 1.55, 5.4], fov: 30 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      /* Si el auto no puede dibujarse, mejor nada que un lienzo roto. */
      fallback={<div className="coche-fallback" aria-hidden />}
      aria-hidden
    >
      {/* Si el equipo no sostiene la escena, baja la resolucion y quita el
          reflejo del piso; si se recupera, los devuelve. */}
      <PerformanceMonitor onDecline={() => setCalidadAlta(false)} onIncline={() => setCalidadAlta(true)} />
      <AdaptiveDpr pixelated={false} />

      <Suspense fallback={null}>
        <Estudio />
        <Concepto animado={animado} alCargar={alCargar} />
        <Piso calidadAlta={calidadAlta} />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.75} scale={11} blur={2.4} far={2.5} resolution={512} />

        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={0.6} />
          <Vignette offset={0.25} darkness={0.7} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODELO, DRACO)
