import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  AdaptiveDpr, ContactShadows, Environment, Lightformer, MeshReflectorMaterial, PerformanceMonitor, useGLTF,
} from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { AdditiveBlending, Box3, CanvasTexture, SRGBColorSpace, Vector3 } from 'three'
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
// Con margen para cualquier angulo del giro: de frente el auto es angosto,
// pero de lado ocupa todo su largo y no debe tocar los bordes.
const DISTANCIA_FINAL = 6.3
const DISTANCIA_INICIAL = 8.8
/** Proporcion ancho/alto para la que esta calibrada la distancia (el hero de escritorio). */
const ASPECTO_DE_REFERENCIA = 2

/**
 * Color medio del fondo de la pagina: --asfalto (#0d0f13) mas la trama de
 * fibra de carbono que lo aclara un poco. Medido en pantalla: (17, 18, 22).
 * El lienzo, la niebla y el piso lo usan para fundirse sin bordes.
 */
const FONDO = '#111216'
const FONDO_RGB = '17, 18, 22'
/** Radio del piso reflectante; mas alla solo hay un anillo liso del color de fondo. */
const RADIO_PISO = 7

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

/**
 * Piso de showroom pulido: un plano mucho mayor que el encuadre, del color
 * de la pagina. La niebla lo funde con el fondo a lo lejos, asi que no tiene
 * borde visible. El reflejo es nitido cerca del auto y se difumina.
 */
function Piso({ calidadAlta }: { calidadAlta: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
      {/* Un circulo y no un plano infinito: a lo lejos dos superficies casi
          coplanares se pelean en el buffer de profundidad (z-fighting) y el
          piso asomaba como una franja gris en el horizonte. */}
      <circleGeometry args={[RADIO_PISO, 96]} />
      {calidadAlta ? (
        <MeshReflectorMaterial
          blur={[220, 60]} resolution={1024} mixBlur={0.55} mixStrength={4} mixContrast={1.15}
          roughness={1} depthScale={0.9} minDepthThreshold={0.35} maxDepthThreshold={1.4}
          // El piso no se sombrea con la luz del estudio (si lo hiciera, el
          // panel lateral lo aclaraba en una mancha gris): su base es un
          // color constante, el del fondo, y solo se le suma el reflejo.
          color="#000000" emissive={FONDO} emissiveIntensity={1} metalness={0} envMapIntensity={0}
          mirror={0.75}
        />
      ) : (
        // En equipos lentos el reflejo (otra pasada completa de la escena)
        // se cambia por un piso mate.
        <meshStandardMaterial color={FONDO} roughness={0.85} metalness={0} envMapIntensity={0.05} />
      )}
    </mesh>
  )
}

/** Degradado radial rojo pintado una vez en un canvas: no se descarga nada. */
function texturaHalo(): CanvasTexture {
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = 256
  const ctx = lienzo.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, 'rgba(255, 45, 35, 0.9)')
    g.addColorStop(0.35, 'rgba(225, 6, 0, 0.35)')
    g.addColorStop(1, 'rgba(225, 6, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const textura = new CanvasTexture(lienzo)
  textura.colorSpace = SRGBColorSpace
  return textura
}

/**
 * Fundido del piso: un degradado radial transparente bajo el auto y del
 * color exacto de la pagina hacia afuera. El piso reflectante amplifica lo
 * que refleja y queda un poco mas claro que el fondo; sin este fundido se
 * veia como una banda gris con linea de horizonte.
 */
function texturaFundido(): CanvasTexture {
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = 512
  const ctx = lienzo.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256)
    g.addColorStop(0, `rgba(${FONDO_RGB}, 0)`)
    // Opaco antes de llegar al borde del piso (radio 7 de 12): el borde del
    // circulo queda siempre tapado.
    g.addColorStop(0.2, `rgba(${FONDO_RGB}, 0)`)
    g.addColorStop(0.5, `rgba(${FONDO_RGB}, 1)`)
    g.addColorStop(1, `rgba(${FONDO_RGB}, 1)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
  }
  const textura = new CanvasTexture(lienzo)
  textura.colorSpace = SRGBColorSpace
  return textura
}

function FundidoPiso() {
  const textura = useMemo(() => texturaFundido(), [])
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={2}>
        <planeGeometry args={[24, 24]} />
        <meshBasicMaterial map={textura} transparent depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      {/* Mas alla del degradado, el mismo color liso hasta perderse de vista. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} renderOrder={2}>
        <ringGeometry args={[RADIO_PISO - 0.05, 70, 96]} />
        <meshBasicMaterial color={FONDO} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </>
  )
}

/** Halo rojo tenue en el piso, debajo del auto: suma luz, no la tapa. */
function Halo() {
  const textura = useMemo(() => texturaHalo(), [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} renderOrder={3}>
      <planeGeometry args={[6, 6]} />
      <meshBasicMaterial map={textura} transparent opacity={0.2} blending={AdditiveBlending}
                         depthWrite={false} toneMapped={false} />
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
      // near/far ajustados a la escena: mas precision de profundidad que el
      // rango por defecto (0,1 a 1000).
      camera={{ position: [6.3, 1.55, 6.8], fov: 30, near: 0.5, far: 80 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      // Mismo color que la pagina: junto con la mascara CSS del contenedor,
      // el lienzo no se ve como una caja.
      onCreated={({ gl }) => gl.setClearColor(FONDO, 1)}
      /* Si el auto no puede dibujarse, mejor nada que un lienzo roto. */
      fallback={<div className="coche-fallback" aria-hidden />}
      aria-hidden
    >
      {/* Si el equipo no sostiene la escena, baja la resolucion y quita el
          reflejo del piso; si se recupera, los devuelve. */}
      <PerformanceMonitor onDecline={() => setCalidadAlta(false)} onIncline={() => setCalidadAlta(true)} />
      <AdaptiveDpr pixelated={false} />

      <color attach="background" args={[FONDO]} />
      {/* La niebla funde el piso con el fondo a lo lejos: sin horizonte. */}
      <fog attach="fog" args={[FONDO, 7, 16]} />

      <Suspense fallback={null}>
        <Estudio />
        <Concepto animado={animado} alCargar={alCargar} />
        <Piso calidadAlta={calidadAlta} />
        <FundidoPiso />
        <Halo />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={10} blur={2.6} far={2.2} resolution={512} />

        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODELO, DRACO)
