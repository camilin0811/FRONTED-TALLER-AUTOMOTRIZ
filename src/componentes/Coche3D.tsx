import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdaptiveDpr, ContactShadows, Environment, Html, Lightformer, MeshReflectorMaterial, OrbitControls,
  PerformanceMonitor, useGLTF,
} from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { AdditiveBlending, Box3, CanvasTexture, SRGBColorSpace, Vector3 } from 'three'
import type { Group, Object3D } from 'three'
import type { OrbitControls as ControlesOrbita } from 'three-stdlib'
import { ZONAS, type IdZona } from '../servicios'

/**
 * Vitrina 3D del taller: el auto "Car Concept" (Eric Chadwick, CC BY 4.0,
 * creditos en public/models/CREDITS.md) en un estudio iluminado con paneles
 * de luz, sobre un piso de showroom.
 *
 * En la pagina de acceso es interactiva: se gira con el raton o el dedo
 * (con inercia), tiene parallax y cuatro puntos (motor, frenos, suspension y
 * electronica) que acercan la camara y abren una tarjeta. La tarjeta y su
 * linea viven fuera del lienzo, en CocheEscaparate; aqui solo se calcula
 * donde cae en pantalla el punto activo.
 *
 * Este modulo solo se carga de forma diferida desde CocheEscaparate.
 */

const MODELO = '/models/concepto.glb'
const DRACO = '/draco/'

/** Vista general: distancia de la camara y punto al que mira. */
const DISTANCIA_GENERAL = 6.3
const DISTANCIA_ENTRADA = 8.8
const OBJETIVO_GENERAL = new Vector3(0, 0.55, 0)
/** Distancia de la camara a un punto cuando se acerca a esa zona. */
const DISTANCIA_ZONA = 3.3
/** Proporcion ancho/alto para la que estan calibradas las distancias. */
const ASPECTO_DE_REFERENCIA = 2

/**
 * Color medio del fondo de la pagina: --asfalto (#0d0f13) mas la trama de
 * fibra de carbono que lo aclara un poco. Medido en pantalla: (17, 18, 22).
 */
const FONDO = '#111216'
const FONDO_RGB = '17, 18, 22'
/** Radio del piso reflectante; mas alla solo hay un anillo liso del color de fondo. */
const RADIO_PISO = 7

/** En un lienzo angosto (celular) la camara se aleja para que nada se corte. */
const factorAspecto = (ancho: number, alto: number) =>
  Math.max(1, ASPECTO_DE_REFERENCIA / (ancho / Math.max(1, alto)))

/** Posicion de la vista general: tres cuartos, un poco por encima del auto. */
function posicionGeneral(distancia: number): Vector3 {
  return new Vector3(distancia * 0.68, 1.55, distancia * 0.73)
}

/** Donde va cada punto, en el espacio del auto, y hacia donde "mira". */
interface PuntoZona {
  id: IdZona
  posicion: Vector3
  normal: Vector3
}

/**
 * Ubica los puntos a partir de las piezas del modelo por su nombre, asi no
 * hay coordenadas a mano que se desajusten si cambia el modelo. Las cajas se
 * miden en el mundo y se pasan al espacio del grupo del auto.
 */
function calcularPuntos(escena: Object3D, grupo: Group): PuntoZona[] {
  const caja = (nombre: string) => {
    const nodo = escena.getObjectByName(nombre)
    return nodo ? new Box3().setFromObject(nodo) : null
  }
  const local = (v: Vector3) => grupo.worldToLocal(v.clone())
  const puntos: PuntoZona[] = []
  const motor = caja('Engine'); const capo = caja('BodyHood')
  if (motor && capo) {
    const c = motor.getCenter(new Vector3())
    puntos.push({ id: 'motor', posicion: local(new Vector3(c.x, capo.max.y + 0.06, c.z)), normal: new Vector3(0, 1, 0.6) })
  }
  const delantera = caja('WheelFrontL')
  if (delantera) {
    const c = delantera.getCenter(new Vector3())
    puntos.push({ id: 'frenos', posicion: local(new Vector3(delantera.max.x + 0.05, c.y, c.z)), normal: new Vector3(1, 0.15, 0.2) })
  }
  const trasera = caja('WheelRearL')
  if (trasera) {
    const c = trasera.getCenter(new Vector3())
    puntos.push({ id: 'suspension', posicion: local(new Vector3(trasera.max.x + 0.05, trasera.max.y - 0.04, c.z)), normal: new Vector3(1, 0.4, -0.2) })
  }
  const tablero = caja('InteriorDashMid')
  if (tablero) {
    const c = tablero.getCenter(new Vector3())
    puntos.push({ id: 'obd', posicion: local(new Vector3(c.x, tablero.max.y + 0.04, c.z)), normal: new Vector3(0.35, 0.9, 0.5) })
  }
  puntos.forEach((p) => p.normal.normalize())
  return puntos
}

export interface PuntoEnPantalla { x: number; y: number; visible: boolean }

interface PropsAuto {
  animado: boolean
  interactivo: boolean
  zonaActiva: IdZona | null
  arrastrando: boolean
  alElegirZona?: (zona: IdZona) => void
  alProyectar?: (punto: PuntoEnPantalla) => void
  alCargar?: () => void
}

function Concepto({ animado, interactivo, zonaActiva, arrastrando, alElegirZona, alProyectar, alCargar }: PropsAuto) {
  const gltf = useGLTF(MODELO, DRACO)
  const grupo = useRef<Group>(null)
  const ruedas = useRef<Object3D[]>([])
  const [puntos, setPuntos] = useState<PuntoZona[]>([])
  const botones = useRef(new Map<IdZona, HTMLButtonElement>())
  const temporizador = useRef<number | undefined>(undefined)
  const { camera, controls, size } = useThree()
  const vuelo = useRef<{ posicion: Vector3; objetivo: Vector3 } | null>(null)

  // Clon propio: el acceso y el portal no deben compartir transformaciones.
  const escena = useMemo(() => gltf.scene.clone(true), [gltf])

  useLayoutEffect(() => {
    // Escala conocida, centrado y ruedas sobre el piso.
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
    if (grupo.current) {
      grupo.current.updateMatrixWorld(true)
      setPuntos(calcularPuntos(escena, grupo.current))
    }
    alCargar?.()
  }, [escena, alCargar])

  // Entrada: la camara arranca lejos y se acerca a la vista general.
  useEffect(() => {
    const f = factorAspecto(size.width, size.height)
    camera.position.copy(posicionGeneral((animado ? DISTANCIA_ENTRADA : DISTANCIA_GENERAL) * f))
    vuelo.current = { posicion: posicionGeneral(DISTANCIA_GENERAL * f), objetivo: OBJETIVO_GENERAL.clone() }
    // Solo al montar: un cambio de tamano no debe relanzar la entrada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al elegir una zona la camara vuela hacia ella; al volver, a la vista general.
  useEffect(() => {
    const f = factorAspecto(size.width, size.height)
    const punto = puntos.find((p) => p.id === zonaActiva)
    if (!punto || !grupo.current) {
      vuelo.current = { posicion: posicionGeneral(DISTANCIA_GENERAL * f), objetivo: OBJETIVO_GENERAL.clone() }
      return
    }
    const enMundo = grupo.current.localToWorld(punto.posicion.clone())
    const normal = punto.normal.clone().transformDirection(grupo.current.matrixWorld)
    const posicion = enMundo.clone().addScaledVector(normal, DISTANCIA_ZONA * f).add(new Vector3(0, 0.35, 0))
    // El encuadre deja el punto lejos de la tarjeta. En escritorio la tarjeta
    // esta a la izquierda: se mira un poco a la izquierda del punto, que cae
    // en la mitad derecha. En el celular la tarjeta ocupa la franja de
    // arriba: se mira por encima del punto, que cae en la mitad baja.
    const angosto = size.width / Math.max(1, size.height) < 1.2
    const haciaPunto = enMundo.clone().sub(posicion).normalize()
    const derecha = new Vector3().crossVectors(haciaPunto, new Vector3(0, 1, 0)).normalize()
    const objetivo = angosto
      ? enMundo.clone().add(new Vector3(0, 0.45, 0))
      : enMundo.clone().addScaledVector(derecha, -0.75).add(new Vector3(0, 0.1, 0))
    vuelo.current = { posicion, objetivo }
  }, [zonaActiva, puntos, size.width, size.height])

  // Si el usuario arrastra, manda el: se cancela cualquier vuelo en curso y
  // cualquier punto pendiente de abrirse por haber pasado el raton encima.
  useEffect(() => {
    if (!arrastrando) return
    vuelo.current = null
    window.clearTimeout(temporizador.current)
  }, [arrastrando])

  const enMundo = useMemo(() => new Vector3(), [])
  const haciaCamara = useMemo(() => new Vector3(), [])
  const normalMundo = useMemo(() => new Vector3(), [])

  useFrame((estado, delta) => {
    const ctrl = controls as unknown as ControlesOrbita | null
    if (animado) for (const pieza of ruedas.current) pieza.rotation.x -= delta * 2.4

    // Parallax: el auto se inclina unos grados hacia el cursor. Se aplica al
    // auto y no a la camara para no pelear con los controles de orbita.
    const g = grupo.current
    if (g) {
      const libre = animado && interactivo && !zonaActiva && !arrastrando
      const rx = libre ? -estado.pointer.y * 0.035 : 0
      const ry = -0.6 + (libre ? estado.pointer.x * 0.07 : 0)
      const t = Math.min(1, delta * 3)
      g.rotation.x += (rx - g.rotation.x) * t
      g.rotation.y += (ry - g.rotation.y) * t
    }

    // Vuelo de camara suave (o inmediato si el visitante pidio menos movimiento).
    if (vuelo.current && ctrl) {
      const t = animado ? 1 - Math.exp(-delta * 3) : 1
      camera.position.lerp(vuelo.current.posicion, t)
      ctrl.target.lerp(vuelo.current.objetivo, t)
      if (camera.position.distanceTo(vuelo.current.posicion) < 0.01) vuelo.current = null
    }

    // Puntos: se esconden cuando quedan del otro lado del auto, y el activo
    // informa donde cae en pantalla para dibujar la linea de su tarjeta.
    if (!g) return
    for (const p of puntos) {
      g.localToWorld(enMundo.copy(p.posicion))
      normalMundo.copy(p.normal).transformDirection(g.matrixWorld)
      haciaCamara.copy(camera.position).sub(enMundo).normalize()
      const visible = normalMundo.dot(haciaCamara) > 0.05
      const boton = botones.current.get(p.id)
      if (boton) boton.dataset.oculto = visible ? 'no' : 'si'
      if (p.id === zonaActiva && alProyectar) {
        const v = enMundo.clone().project(camera)
        alProyectar({
          x: (v.x + 1) / 2 * estado.size.width,
          y: (1 - v.y) / 2 * estado.size.height,
          visible: visible && v.z < 1,
        })
      }
    }
  })

  const elegir = (id: IdZona, inmediato: boolean) => {
    window.clearTimeout(temporizador.current)
    if (inmediato) alElegirZona?.(id)
    // Al pasar el raton se espera un instante: cruzar por encima de un punto
    // camino a otro lado no debe mover la camara.
    else temporizador.current = window.setTimeout(() => alElegirZona?.(id), 280)
  }

  return (
    <group ref={grupo} rotation={[0, -0.6, 0]}>
      <primitive object={escena} />
      {interactivo && puntos.map((p) => {
        const zona = ZONAS.find((z) => z.id === p.id)
        return (
          <Html key={p.id} position={p.posicion} center zIndexRange={[30, 10]}>
            <button
              type="button"
              ref={(el) => { if (el) botones.current.set(p.id, el); else botones.current.delete(p.id) }}
              className={`punto-zona ${zonaActiva === p.id ? 'activo' : ''}`}
              aria-label={`Ver ${zona?.nombre}`}
              aria-pressed={zonaActiva === p.id}
              // Solo al pasar el raton sin botones pulsados: cruzar un punto
              // mientras se arrastra para girar el auto no debe abrirlo.
              onPointerEnter={(e) => { if (e.pointerType === 'mouse' && e.buttons === 0) elegir(p.id, false) }}
              onPointerLeave={() => window.clearTimeout(temporizador.current)}
              onClick={() => elegir(p.id, true)}
            >
              <span className="punto-zona-nucleo" aria-hidden />
              <span className="punto-zona-etiqueta">{zona?.nombre}</span>
            </button>
          </Html>
        )
      })}
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
 * Piso de showroom pulido. Su base es un color constante, el del fondo (no
 * se sombrea con la luz del estudio, que lo aclaraba en una mancha gris), y
 * solo se le suma el reflejo del auto.
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
          blur={[160, 40]} resolution={1024} mixBlur={0.45} mixStrength={7} mixContrast={1.2}
          roughness={1} depthScale={0.8} minDepthThreshold={0.3} maxDepthThreshold={1.4}
          color="#000000" emissive={FONDO} emissiveIntensity={1} metalness={0} envMapIntensity={0}
          mirror={0.85}
        />
      ) : (
        // En equipos lentos el reflejo (otra pasada completa de la escena)
        // se cambia por un piso mate.
        <meshStandardMaterial color={FONDO} roughness={0.85} metalness={0} envMapIntensity={0.05} />
      )}
    </mesh>
  )
}

/**
 * Halo rojo: un degradado con caida suave (muchas paradas, casi gaussiana)
 * para que no tenga borde ni forma de mancha ovalada.
 */
function texturaHalo(): CanvasTexture {
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = 256
  const ctx = lienzo.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      g.addColorStop(t, `rgba(225, 20, 10, ${(0.55 * Math.exp(-5 * t * t)).toFixed(3)})`)
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const textura = new CanvasTexture(lienzo)
  textura.colorSpace = SRGBColorSpace
  return textura
}

/**
 * Fundido del piso: transparente bajo el auto y del color exacto de la
 * pagina hacia afuera. Sin el, el piso se veia como una banda gris.
 */
function texturaFundido(): CanvasTexture {
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = 512
  const ctx = lienzo.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256)
    g.addColorStop(0, `rgba(${FONDO_RGB}, 0)`)
    // Opaco antes de llegar al borde del piso (radio 7 de 12).
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} renderOrder={3}>
      <planeGeometry args={[8, 8]} />
      <meshBasicMaterial map={textura} transparent opacity={0.22} blending={AdditiveBlending}
                         depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export interface PropsCoche3D {
  animado: boolean
  /** false cuando la vitrina no esta a la vista: el render se detiene. */
  activo: boolean
  /** Con controles de orbita, parallax y puntos (pagina de acceso). */
  interactivo?: boolean
  /** La rueda del raton hace zoom solo cuando el visitante ya interactuo con el auto. */
  zoomHabilitado?: boolean
  zonaActiva?: IdZona | null
  alElegirZona?: (zona: IdZona) => void
  alProyectar?: (punto: PuntoEnPantalla) => void
  alCargar?: () => void
}

export default function Coche3D({
  animado, activo, interactivo = false, zoomHabilitado = false, zonaActiva = null,
  alElegirZona, alProyectar, alCargar,
}: PropsCoche3D) {
  const [calidadAlta, setCalidadAlta] = useState(true)
  const [arrastrando, setArrastrando] = useState(false)
  const reanudar = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(reanudar.current), [])

  return (
    <Canvas
      frameloop={activo ? 'always' : 'never'}
      dpr={[1, 1.75]}
      // near/far ajustados a la escena: mas precision de profundidad que el
      // rango por defecto (0,1 a 1000).
      camera={{ position: [6.3, 1.55, 6.8], fov: 30, near: 0.5, far: 80 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor(FONDO, 1)}
      /* Si el auto no puede dibujarse, mejor nada que un lienzo roto. */
      fallback={<div className="coche-fallback" aria-hidden />}
    >
      <PerformanceMonitor onDecline={() => setCalidadAlta(false)} onIncline={() => setCalidadAlta(true)} />
      <AdaptiveDpr pixelated={false} />

      <color attach="background" args={[FONDO]} />
      <fog attach="fog" args={[FONDO, 7, 16]} />

      <OrbitControls
        makeDefault
        enabled={interactivo}
        enableDamping
        dampingFactor={0.07}
        enablePan={false}
        enableZoom={interactivo && zoomHabilitado}
        minDistance={3.2}
        maxDistance={9.5}
        // Nunca por debajo del piso ni mirando desde el cenit.
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.1}
        // Giro automatico lento: se pausa mientras el usuario arrastra (y unos
        // segundos despues) y mientras hay una zona abierta.
        autoRotate={animado && !arrastrando && !zonaActiva}
        autoRotateSpeed={0.55}
        target={[0, 0.55, 0]}
        onStart={() => { window.clearTimeout(reanudar.current); setArrastrando(true) }}
        onEnd={() => { reanudar.current = window.setTimeout(() => setArrastrando(false), 3000) }}
      />

      <Suspense fallback={null}>
        <Estudio />
        <Concepto
          animado={animado} interactivo={interactivo} zonaActiva={zonaActiva} arrastrando={arrastrando}
          alElegirZona={alElegirZona} alProyectar={alProyectar} alCargar={alCargar}
        />
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
