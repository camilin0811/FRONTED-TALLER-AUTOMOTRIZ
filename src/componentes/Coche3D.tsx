/*
 * Para qué sirve: Escena 3D del auto: modelo, luces, piso, modos Real/Escáner/Plano, puntos
 * interactivos y reacción al formulario de acceso.
 * PATRÓN Game Loop / Update Method: cada pieza de la escena se actualiza en useFrame, una vez por
 *     cuadro; los cambios de modo y las luces avanzan con el tiempo transcurrido.
 * PATRÓN Observer (publicar/suscribir): OrbitControls avisa con onStart/onEnd cuando el usuario
 *     arrastra, para pausar el giro automático.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdaptiveDpr, ContactShadows, Environment, Html, Lightformer, Line, MeshReflectorMaterial, OrbitControls,
  PerformanceMonitor, useGLTF,
} from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import {
  AdditiveBlending, BackSide, Box3, BufferGeometry, CanvasTexture, Color, DoubleSide, EdgesGeometry,
  Float32BufferAttribute, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, Ray,
  RepeatWrapping, SRGBColorSpace, ShaderMaterial, Vector3,
} from 'three'
import type { Fog, Group, Material, MeshStandardMaterial, Object3D, PerspectiveCamera, Scene } from 'three'
import type { Line2, OrbitControls as ControlesOrbita } from 'three-stdlib'
import { ZONAS, type IdZona } from '../servicios'

/**
 * Vitrina 3D del taller: el auto "Car Concept" (Eric Chadwick, CC BY 4.0,
 * creditos en public/models/CREDITS.md) en un estudio iluminado con paneles
 * de luz, sobre un piso de showroom.
 *
 * En la pagina de acceso es interactiva: se gira con el raton o el dedo, tiene
 * parallax, cuatro puntos (motor, frenos, suspension y electronica) que
 * acercan la camara y abren una tarjeta, y tres modos de vista:
 *
 * - Real: los materiales PBR del modelo.
 * - Escaner: holograma (fresnel cian + aristas tenues), una linea de escaneo
 *   que recorre el auto de adelante hacia atras e indicadores flotantes.
 * - Plano: vista lateral ortografica, lineas blancas sobre azul y cotas
 *   medidas del propio modelo.
 *
 * La tarjeta y su linea viven fuera del lienzo, en CocheEscaparate; aqui solo
 * se calcula donde cae en pantalla el punto activo.
 *
 * Este modulo solo se carga de forma diferida desde CocheEscaparate.
 */

const MODELO = '/models/concepto.glb'
const DRACO = '/draco/'

export type Modo = 'real' | 'escaner' | 'plano'
/** Pixeles del lienzo que tapa la tarjeta: a la izquierda (escritorio) o abajo (celular). */
export interface Reserva { izquierda: number; abajo: number }
export interface PuntoEnPantalla { x: number; y: number; visible: boolean }
/** Lo que pasa en el formulario de acceso, para que el auto reaccione. */
export type EstadoAcceso = 'reposo' | 'usuario' | 'clave' | 'entrando' | 'exito' | 'error'
export interface SenalAcceso {
  estado: EstadoAcceso
  /** Sube con cada tecla de la clave: cada una da un pequeno destello. */
  pulso: number
}

/** Vista general: distancia de la camara y punto al que mira. */
const DISTANCIA_GENERAL = 6.3
const DISTANCIA_ENTRADA = 8.8
const DISTANCIA_MAXIMA = 9.5
const OBJETIVO_GENERAL = new Vector3(0, 0.55, 0)
/** Proporcion ancho/alto para la que estan calibradas las distancias. */
const ASPECTO_DE_REFERENCIA = 2
const FOV = 30
/** El plano es una vista con teleobjetivo de 2 grados que termina en una proyeccion ortografica exacta. */
const FOV_PLANO = 2
/** Duracion del cambio de modo (el pedido fija un maximo de 800 ms). */
const DURACION_MODO = 0.7
/** Parte del auto que debe quedar a la vista al enfocar una zona. */
const FRACCION_VISIBLE = 0.6

/**
 * Color medio del fondo de la pagina: --asfalto (#0d0f13) mas la trama de
 * fibra de carbono que lo aclara un poco. Medido en pantalla: (17, 18, 22).
 */
const FONDO = '#111216'
const AZUL_PLANO = '#0d2a4a'
const RELLENO_PLANO = '#10335a'
const TRAZO_PLANO = '#dbe8ff'
const CIAN = '#38e1ff'
const AZUL_HOLO = '#0a4cff'
const ROJO_HALO = '#e1140a'
const ROJO_ALERTA = '#ff1a10'
const CIAN_CLARO = '#a6f0ff'
/** Radio del piso reflectante; mas alla solo hay un anillo liso del color de fondo. */
const RADIO_PISO = 7

const tan = (grados: number) => Math.tan((grados * Math.PI) / 360)
const suave = (x: number) => x * x * (3 - 2 * x)

/** En un lienzo angosto (celular) la camara se aleja para que nada se corte. */
const factorAspecto = (ancho: number, alto: number) =>
  Math.max(1, ASPECTO_DE_REFERENCIA / (ancho / Math.max(1, alto)))

/** Direccion de la vista general: tres cuartos, un poco por encima del auto. */
function posicionGeneral(distancia: number): Vector3 {
  return new Vector3(distancia * 0.68, 1.55, distancia * 0.73)
}

/**
 * Estado del cambio de modo, compartido por todas las piezas de la escena.
 * `crudo` avanza linealmente; los pesos publicos ya tienen la curva suave.
 */
interface Mezcla {
  objetivo: Modo
  crudo: Record<Modo, number>
  real: number
  escaner: number
  plano: number
  fondo: Color
}

/**
 * Caja exacta de un nodo en el espacio de `raiz` (no en el del mundo), vertice
 * por vertice: la caja de una caja girada se agranda (una rueda daba 1.050 mm
 * en vez de 770) y las cotas del plano deben ser las medidas reales.
 */
function cajaEn(nodo: Object3D, raiz: Object3D): Box3 {
  raiz.updateWorldMatrix(true, true)
  const inversa = raiz.matrixWorld.clone().invert()
  const caja = new Box3(); const m = new Matrix4(); const v = new Vector3()
  nodo.traverse((o) => {
    const malla = o as Mesh
    if (!malla.isMesh) return
    m.multiplyMatrices(inversa, o.matrixWorld)
    const pos = malla.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) caja.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m))
  })
  return caja
}

/** Punto interactivo, en el espacio del grupo del auto, y hacia donde "mira". */
interface PuntoZona { id: IdZona; posicion: Vector3; normal: Vector3 }

/** Todo lo que se mide del modelo una vez normalizado (espacio del grupo). */
interface Medidas {
  puntos: PuntoZona[]
  /** Volumenes simplificados del auto para saber si un punto queda detras. */
  oclusores: Box3[]
  auto: Box3
  ejeDelantero: number
  ejeTrasero: number
  radioRueda: number
  techoZ: number
  /** Medidas reales del modelo, en milimetros. */
  mm: { largo: number; alto: number; ejes: number; rueda: number }
  /** `ancla`: punto del auto al que apunta el indicador con una linea guia. */
  indicadores: { id: string; etiqueta: string; valor: string; posicion: Vector3; ancla?: Vector3 }[]
}

/**
 * Ubica puntos, oclusores e indicadores a partir de las piezas del modelo por
 * su nombre (medidas en unidades del archivo, metros) y los pasa al espacio
 * del grupo con la escala y el centrado aplicados.
 */
function medir(escena: Object3D): Medidas {
  escena.updateMatrix()
  const aGrupo = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(escena.matrix)
  const caja = (nombre: string) => {
    const nodo = escena.getObjectByName(nombre)
    return nodo ? cajaEn(nodo, escena) : null
  }
  const total = cajaEn(escena, escena)
  const motor = caja('Engine')
  const rin = caja('WheelFrontLRim')
  const delantera = caja('WheelFrontL')
  const trasera = caja('WheelRearL')
  const parabrisas = caja('BodyWindshield')
  const techo = caja('BodyRoofPanel')

  const puntos: PuntoZona[] = []
  const indicadores: Medidas['indicadores'] = []
  // Motor: sobre el capo, en la trompa.
  if (motor) {
    const c = motor.getCenter(new Vector3())
    puntos.push({ id: 'motor', posicion: aGrupo(0, motor.max.y + 0.08, c.z), normal: new Vector3(0, 0.8, 1) })
    indicadores.push({ id: 'temp', etiqueta: 'Temperatura', valor: '92 °C', posicion: aGrupo(-0.3, motor.max.y + 0.8, c.z - 0.75) })
  }
  // Frenos: en el centro del rin delantero, donde se ve el disco.
  if (rin) {
    const c = rin.getCenter(new Vector3())
    puntos.push({ id: 'frenos', posicion: aGrupo(rin.max.x + 0.02, c.y, c.z), normal: new Vector3(1, 0, 0.1) })
    // Bajo y detras de la rueda (lejos del punto del motor, que va en el capo, y
    // del de frenos, en el centro del rin), con una linea al borde del rin.
    indicadores.push({
      id: 'frenos', etiqueta: 'Frenos', valor: 'Pastillas 78 %',
      posicion: aGrupo(rin.max.x + 0.3, c.y - 0.16, c.z - 1.4),
      ancla: aGrupo(rin.max.x, c.y - (rin.max.y - rin.min.y) * 0.3, c.z - (rin.max.z - rin.min.z) * 0.3),
    })
  }
  // Suspension: sobre la rueda trasera, donde va el amortiguador.
  if (trasera) {
    const c = trasera.getCenter(new Vector3())
    puntos.push({ id: 'suspension', posicion: aGrupo(trasera.max.x + 0.02, trasera.max.y + 0.02, c.z), normal: new Vector3(1, 0.45, 0) })
    indicadores.push({ id: 'bateria', etiqueta: 'Batería', valor: '12,6 V', posicion: aGrupo(0, trasera.max.y + 0.62, c.z - 0.15) })
  }
  // Electronica: en el parabrisas, frente al puesto del conductor (lejos del
  // punto del motor: antes los dos se superponian en la trompa).
  if (parabrisas) {
    const c = parabrisas.getCenter(new Vector3())
    puntos.push({ id: 'obd', posicion: aGrupo(0.38, c.y + 0.06, c.z), normal: new Vector3(0.3, 0.9, 0.45) })
  }
  puntos.forEach((p) => p.normal.normalize())

  // Carroceria baja y cabina, un poco mas chicas que el auto real para que
  // los puntos (que van sobre la superficie) queden fuera de ellas.
  const oclusores = [
    new Box3(new Vector3(-1.02, 0.12, total.min.z + 0.1), new Vector3(1.02, 0.78, total.max.z - 0.12)),
    new Box3(new Vector3(-0.62, 0.78, -0.95), new Vector3(0.62, 1.12, 0.72)),
  ].map((b) => b.applyMatrix4(escena.matrix))

  const auto = total.clone().applyMatrix4(escena.matrix)
  const escala = escena.scale.x
  const centroZ = (b: Box3 | null, defecto: number) => (b ? aGrupo(0, 0, b.getCenter(new Vector3()).z).z : defecto)
  const redondear = (metros: number) => Math.round(metros * 100) * 10
  const tamano = total.getSize(new Vector3())
  return {
    puntos, oclusores, auto, indicadores,
    ejeDelantero: centroZ(delantera, auto.max.z - 0.9),
    ejeTrasero: centroZ(trasera, auto.min.z + 0.7),
    radioRueda: delantera ? (delantera.max.y - delantera.min.y) / 2 * escala : 0.37,
    techoZ: centroZ(techo, 0),
    mm: {
      largo: redondear(tamano.z),
      alto: redondear(tamano.y),
      ejes: delantera && trasera ? redondear(Math.abs(delantera.getCenter(new Vector3()).z - trasera.getCenter(new Vector3()).z)) : 0,
      rueda: delantera ? redondear(delantera.max.y - delantera.min.y) : 0,
    },
  }
}

/* ------------------------------------------------------- materiales */

const VERTICE_HOLO = /* glsl */ `
  uniform mat4 uAlGrupo;
  varying vec3 vNormal;
  varying vec3 vVista;
  varying float vZ;
  void main() {
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vZ = (uAlGrupo * mundo).z;
    vec4 mv = viewMatrix * mundo;
    vNormal = normalize(normalMatrix * normal);
    vVista = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`
const FRAGMENTO_HOLO = /* glsl */ `
  uniform float uOpacidad;
  uniform float uEnergia;
  uniform float uAlerta;
  uniform vec3 uRojo;
  uniform float uBarrido;
  uniform vec3 uCian;
  uniform vec3 uAzul;
  varying vec3 vNormal;
  varying vec3 vVista;
  varying float vZ;
  void main() {
    // Fresnel: los bordes que se ven de canto brillan, las caras de frente casi no.
    float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vVista))), 2.2);
    // Linea de escaneo y la estela que deja en la parte ya revisada (adelante).
    float banda = exp(-pow((vZ - uBarrido) / 0.05, 2.0));
    float estela = step(uBarrido, vZ) * exp(-(vZ - uBarrido) / 0.7);
    vec3 color = mix(uAzul, uCian, f) + uCian * banda * 1.4;
    // Reaccion al formulario: pulso de brillo y, si el acceso falla, rojo.
    color = mix(color, uRojo, uAlerta);
    float alfa = (0.04 + 0.5 * f + 0.9 * banda + 0.12 * estela) * uOpacidad * (1.0 + uEnergia);
    gl_FragColor = vec4(color, alfa);
  }
`

const VERTICE_CONTORNO = /* glsl */ `
  uniform float uGrosor;
  void main() {
    // Casco invertido: la cara trasera, inflada a lo largo de la normal, solo
    // asoma alrededor de la silueta y la dibuja como una linea.
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * uGrosor, 1.0);
  }
`
const FRAGMENTO_CONTORNO = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacidad;
  void main() { gl_FragColor = vec4(uColor, uOpacidad); }
`

interface Capas {
  holo: ShaderMaterial
  contorno: ShaderMaterial
  relleno: MeshBasicMaterial
  aristas: LineBasicMaterial
  originales: { material: Material; transparente: boolean; opacidad: number }[]
  mallas: Mesh[]
  /** Materiales emisivos del modelo: faros, luces traseras y direccionales. */
  luces: { material: MeshStandardMaterial; tipo: 'faro' | 'trasera' | 'direccional'; color: Color; intensidad: number }[]
}

const TIPO_LUZ: Record<string, Capas['luces'][number]['tipo']> = {
  Headlight: 'faro', Brakelight: 'trasera', Signallight: 'direccional',
}

/**
 * A cada malla del auto se le agregan dos hijas con la misma geometria (el
 * holograma y el relleno del plano) y, mas tarde, sus aristas. Como son
 * hijas, giran con las ruedas sin codigo extra. Los materiales son tres en
 * total, compartidos: cambiar de modo es tocar tres materiales, no cien.
 */
function crearCapas(escena: Object3D): Capas {
  const holo = new ShaderMaterial({
    vertexShader: VERTICE_HOLO, fragmentShader: FRAGMENTO_HOLO,
    uniforms: {
      uOpacidad: { value: 0 }, uBarrido: { value: -99 }, uAlGrupo: { value: new Matrix4() },
      uCian: { value: new Color(CIAN) }, uAzul: { value: new Color(AZUL_HOLO) },
      uEnergia: { value: 0 }, uAlerta: { value: 0 }, uRojo: { value: new Color(ROJO_ALERTA) },
    },
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  })
  holo.visible = false
  // Relleno del plano: tapa las aristas que quedan detras de una superficie.
  // polygonOffset lo empuja un poco atras para que las aristas de la propia
  // superficie sigan viendose.
  const relleno = new MeshBasicMaterial({
    color: RELLENO_PLANO, transparent: true, opacity: 0, fog: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  })
  relleno.visible = false
  // La carroceria es lisa: sus aristas no marcan la silueta. El contorno la
  // dibuja en el plano.
  const contorno = new ShaderMaterial({
    vertexShader: VERTICE_CONTORNO, fragmentShader: FRAGMENTO_CONTORNO,
    uniforms: { uGrosor: { value: 0.012 }, uColor: { value: new Color(TRAZO_PLANO) }, uOpacidad: { value: 0 } },
    side: BackSide, transparent: true,
  })
  contorno.visible = false
  const aristas = new LineBasicMaterial({ color: CIAN, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false })
  aristas.visible = false

  const originales: Capas['originales'] = []
  const luces: Capas['luces'] = []
  const mallas: Mesh[] = []
  const vistos = new Set<Material>()
  escena.traverse((o) => {
    const malla = o as Mesh
    if (!malla.isMesh) return
    mallas.push(malla)
    // Materiales propios de esta vitrina: el portal usa el mismo modelo y no
    // debe desvanecerse cuando aqui se cambia de modo.
    malla.material = Array.isArray(malla.material) ? malla.material.map((m) => m.clone()) : malla.material.clone()
    for (const m of Array.isArray(malla.material) ? malla.material : [malla.material]) {
      if (vistos.has(m)) continue
      vistos.add(m)
      originales.push({ material: m, transparente: m.transparent, opacidad: m.opacity })
      const tipo = TIPO_LUZ[m.name]
      const estandar = m as MeshStandardMaterial
      if (tipo && estandar.emissive) {
        luces.push({ material: estandar, tipo, color: estandar.emissive.clone(), intensidad: estandar.emissiveIntensity })
      }
    }
  })
  for (const malla of mallas) {
    const h = new Mesh(malla.geometry, holo); h.renderOrder = 4
    const r = new Mesh(malla.geometry, relleno)
    const k = new Mesh(malla.geometry, contorno)
    malla.add(h, r, k)
  }
  return { holo, contorno, relleno, aristas, originales, mallas, luces }
}

/**
 * Las aristas (EdgesGeometry) son caras de calcular para 200 mil triangulos:
 * se hacen de a una malla, en los momentos libres del navegador, despues de
 * cargar. Cuando el visitante elige Escaner o Plano ya estan listas.
 */
function programarAristas(capas: Capas): () => void {
  let cancelado = false
  const cola = [...capas.mallas]
  type Ocioso = (cb: (d: { timeRemaining: () => number }) => void) => number
  const ocioso: Ocioso = (window as unknown as { requestIdleCallback?: Ocioso }).requestIdleCallback
    ?? ((cb) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 32))
  const paso = (d: { timeRemaining: () => number }) => {
    if (cancelado) return
    do {
      const malla = cola.shift()
      if (!malla) return
      const lineas = new LineSegments(new EdgesGeometry(malla.geometry, 22), capas.aristas)
      lineas.renderOrder = 3
      malla.add(lineas)
    } while (d.timeRemaining() > 6)
    ocioso(paso)
  }
  const inicio = window.setTimeout(() => ocioso(paso), 1200)
  return () => { cancelado = true; window.clearTimeout(inicio) }
}

/* ------------------------------------------------------------ el auto */

interface PropsAuto {
  animado: boolean
  interactivo: boolean
  mezcla: MutableRefObject<Mezcla>
  zonaActiva: IdZona | null
  reserva: Reserva
  arrastrando: boolean
  acceso?: SenalAcceso
  alElegirZona?: (zona: IdZona) => void
  alProyectar?: (punto: PuntoEnPantalla) => void
  alCargar?: () => void
}

function Concepto({
  animado, interactivo, mezcla, zonaActiva, reserva, arrastrando, acceso, alElegirZona, alProyectar, alCargar,
}: PropsAuto) {
  const gltf = useGLTF(MODELO, DRACO)
  const grupo = useRef<Group>(null)
  const ruedas = useRef<Object3D[]>([])
  const [medidas, setMedidas] = useState<Medidas | null>(null)
  const capas = useRef<Capas | null>(null)
  const botones = useRef(new Map<IdZona, HTMLButtonElement>())
  const temporizador = useRef<number | undefined>(undefined)
  const barrido = useRef<Mesh>(null)
  const reloj = useRef(0)
  const { camera, controls, size, scene } = useThree() as unknown as {
    camera: PerspectiveCamera; controls: unknown; size: { width: number; height: number }; scene: Scene
  }
  const vuelo = useRef<{ posicion: Vector3; objetivo: Vector3 } | null>(null)
  /** Camara de orbita guardada al entrar al plano, para volver a ella al salir. */
  const guardada = useRef<{ posicion: Vector3; objetivo: Vector3 } | null>(null)
  const desplazamiento = useRef({ x: 0, y: 0, plano: 0 })
  /** Estado animado de las luces y de la reaccion al formulario. */
  const luz = useRef({
    posicion: 0, faros: 0, traseras: 0, destello: 0, vibra: 0, farosAntes: false,
    error: -10, rev: -10, salida: null as null | { t0: number; base: Vector3; objetivo: Vector3 },
  })
  const pozoDelantero = useRef<Mesh>(null)
  const pozoTrasero = useRef<Mesh>(null)
  const estadoAcceso = acceso?.estado ?? 'reposo'
  const pulsoClave = acceso?.pulso ?? 0

  useEffect(() => {
    const l = luz.current
    const ahora = performance.now() / 1000
    if (estadoAcceso === 'error') l.error = ahora
    if (estadoAcceso === 'entrando') l.rev = ahora
    if (estadoAcceso !== 'exito') l.salida = null
  }, [estadoAcceso])
  // Cada tecla de la clave, un destello corto de los faros.
  useEffect(() => {
    if (pulsoClave > 0) luz.current.destello = Math.max(luz.current.destello, 0.35)
  }, [pulsoClave])

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
    setMedidas(medir(escena))
    let cancelar = () => {}
    if (interactivo && !capas.current) {
      capas.current = crearCapas(escena)
      cancelar = programarAristas(capas.current)
    }
    alCargar?.()
    return cancelar
  }, [escena, alCargar, interactivo])

  // Entrada: la camara arranca lejos y se acerca a la vista general.
  useEffect(() => {
    const d = Math.min(DISTANCIA_MAXIMA, DISTANCIA_GENERAL * factorAspecto(size.width, size.height))
    camera.position.copy(posicionGeneral(animado ? Math.max(d, DISTANCIA_ENTRADA) : d))
    vuelo.current = { posicion: posicionGeneral(d), objetivo: OBJETIVO_GENERAL.clone() }
    // Solo al montar: un cambio de tamano no debe relanzar la entrada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Al elegir una zona la camara vuela hacia ella; al volver, a la vista
   * general. La zona queda en el centro del area libre (la que no tapa la
   * tarjeta) y la distancia se calcula para que se vea al menos el 60 % del
   * auto en esa area.
   */
  useEffect(() => {
    const g = grupo.current
    const libreAncho = Math.max(120, size.width - reserva.izquierda)
    const libreAlto = Math.max(120, size.height - reserva.abajo)
    const punto = medidas?.puntos.find((p) => p.id === zonaActiva)
    if (!punto || !g || !medidas) {
      const d = Math.min(DISTANCIA_MAXIMA, DISTANCIA_GENERAL * factorAspecto(libreAncho, libreAlto))
      vuelo.current = { posicion: posicionGeneral(d), objetivo: OBJETIVO_GENERAL.clone() }
      return
    }
    g.updateMatrixWorld(true)
    const objetivo = g.localToWorld(punto.posicion.clone())
    const normal = punto.normal.clone().transformDirection(g.matrixWorld)
    const general = new Vector3(0.68, 0, 0.73).normalize()
    const dir = normal.add(general.multiplyScalar(0.5)).add(new Vector3(0, 0.3, 0)).normalize()

    // Base de la camara mirando al objetivo.
    const adelante = dir.clone().negate()
    const derecha = new Vector3().crossVectors(adelante, new Vector3(0, 1, 0)).normalize()
    const arriba = new Vector3().crossVectors(derecha, adelante)
    const tanV = tan(FOV) * (libreAlto / size.height)
    const tanH = tan(FOV) * (size.width / size.height) * (libreAncho / size.width)
    // Esquinas de la caja del auto acercadas hacia el punto: si caben en el
    // area libre, se ve al menos ese 60 % del auto alrededor de la zona.
    let d = 3
    const a = medidas.auto
    for (const x of [a.min.x, a.max.x]) for (const y of [a.min.y, a.max.y]) for (const z of [a.min.z, a.max.z]) {
      const esquina = g.localToWorld(new Vector3(x, y, z))
      const rel = esquina.sub(objetivo).multiplyScalar(FRACCION_VISIBLE)
      const profundidad = rel.dot(adelante)
      d = Math.max(d, profundidad + Math.abs(rel.dot(derecha)) / tanH, profundidad + Math.abs(rel.dot(arriba)) / tanV)
    }
    d = Math.min(DISTANCIA_MAXIMA, d)
    vuelo.current = { posicion: objetivo.clone().addScaledVector(dir, d), objetivo }
  }, [zonaActiva, medidas, size.width, size.height, reserva.izquierda, reserva.abajo])

  // Si el usuario arrastra, manda el: se cancela cualquier vuelo en curso y
  // cualquier punto pendiente de abrirse por haber pasado el raton encima.
  useEffect(() => {
    if (!arrastrando) return
    vuelo.current = null
    window.clearTimeout(temporizador.current)
  }, [arrastrando])

  const tmp = useMemo(() => ({
    enMundo: new Vector3(), normal: new Vector3(), haciaCamara: new Vector3(), camLocal: new Vector3(),
    rayo: new Ray(), corte: new Vector3(), fondo: new Color(FONDO), azul: new Color(AZUL_PLANO),
    cian: new Color(CIAN), blanco: new Color(TRAZO_PLANO), lateral: new Vector3(), objetivo: new Vector3(),
    rojo: new Color(ROJO_ALERTA), cianClaro: new Color(CIAN_CLARO), trazo: new Color(), faro: new Color('#dce9ff'),
  }), [])

  useFrame((estado, delta) => {
    const ctrl = controls as ControlesOrbita | null
    const m = mezcla.current
    const g = grupo.current

    // 1. Mezcla de modos: lineal en el tiempo, con curva suave en los pesos.
    const paso = animado ? delta / DURACION_MODO : 1
    for (const k of ['real', 'escaner', 'plano'] as Modo[]) {
      const meta = k === m.objetivo ? 1 : 0
      m.crudo[k] += Math.max(-paso, Math.min(paso, meta - m.crudo[k]))
      m[k] = suave(m.crudo[k])
    }
    m.fondo.copy(tmp.fondo).lerp(tmp.azul, m.plano)
    ;(scene.background as Color | null)?.copy(m.fondo)

    // 2. Luces y reaccion al formulario de acceso:
    // - Usuario enfocado: luces de posicion (faros bajos y traseras tenues).
    // - Clave escrita: faros encendidos con un destello (el bloom lo realza).
    // - Entrar: "rev" (vibracion y luces traseras), luego ralenti.
    // - Error: todas las luces parpadean en rojo.
    const l = luz.current
    const ahora = performance.now() / 1000
    const farosOn = estadoAcceso === 'clave' || estadoAcceso === 'entrando' || estadoAcceso === 'exito'
    if (farosOn && !l.farosAntes) l.destello = 1
    l.farosAntes = farosOn
    const hacia = (v: number, meta: number, vel: number) => v + (meta - v) * Math.min(1, delta * vel)
    l.posicion = hacia(l.posicion, estadoAcceso === 'reposo' ? 0 : 1, 6)
    l.faros = hacia(l.faros, farosOn ? 1 : 0, 8)
    const tRev = ahora - l.rev
    const enRev = estadoAcceso === 'entrando' && tRev < 0.9
    l.traseras = hacia(l.traseras, estadoAcceso === 'entrando' ? (enRev ? 1 : 0.6) : l.posicion * 0.25, 10)
    l.vibra = !animado ? 0 : estadoAcceso === 'entrando' ? (enRev ? Math.sin((Math.PI * tRev) / 0.9) : 0.12) : hacia(l.vibra, 0, 8)
    l.destello = animado ? l.destello * Math.exp(-delta * 3.5) : 0
    const tError = ahora - l.error
    // Tres parpadeos en 1,5 s; sin animaciones, rojo fijo ese mismo tiempo.
    const rojo = tError >= 0 && tError < 1.5 ? (!animado || Math.sin(tError * Math.PI * 4) > 0 ? 1 : 0) : 0
    const energia = Math.min(1.5, 0.25 * l.posicion + 0.5 * l.faros + 1.1 * l.destello + 0.4 * l.vibra)

    // 3. Materiales del modo.
    const c = capas.current
    if (c) {
      for (const o of c.originales) {
        o.material.visible = m.real > 0.001
        o.material.opacity = o.opacidad * m.real
        const transparente = o.transparente || m.real < 0.999
        if (o.material.transparent !== transparente) { o.material.transparent = transparente; o.material.needsUpdate = true }
      }
      c.holo.visible = m.escaner > 0.001
      c.holo.uniforms.uOpacidad.value = m.escaner
      if (g) c.holo.uniforms.uAlGrupo.value.copy(g.matrixWorld).invert()
      c.relleno.visible = m.plano > 0.001
      c.relleno.opacity = m.plano
      c.contorno.visible = m.plano > 0.001
      c.contorno.uniforms.uOpacidad.value = m.plano
      c.aristas.visible = m.escaner + m.plano > 0.001
      // Equivalente de las luces en el escaner (pulso cian, rojo si falla) y en
      // el plano (las lineas se iluminan, rojas si falla).
      c.holo.uniforms.uEnergia.value = energia * 0.7
      c.holo.uniforms.uAlerta.value = rojo * 0.85
      tmp.trazo.copy(tmp.blanco).lerp(tmp.cianClaro, Math.min(1, energia))
      if (rojo) tmp.trazo.copy(tmp.rojo)
      c.contorno.uniforms.uColor.value.copy(tmp.trazo)
      c.aristas.opacity = m.escaner * (0.13 + 0.25 * energia + 0.3 * rojo) + m.plano * Math.min(1, 0.7 + 0.3 * energia + rojo)
      c.aristas.color.copy(rojo ? tmp.rojo : tmp.cian).lerp(tmp.trazo, m.plano / Math.max(0.001, m.escaner + m.plano))

      for (const lz of c.luces) {
        const mat = lz.material
        if (rojo) { mat.emissive.copy(tmp.rojo); mat.emissiveIntensity = 9; continue }
        mat.emissive.copy(lz.color)
        const k = lz.tipo === 'faro' ? 0.15 + l.posicion * 0.6 + l.faros * 2.2 + l.destello * 5
          : lz.tipo === 'trasera' ? 0.3 + l.traseras * 4 : 1
        mat.emissiveIntensity = lz.intensidad * k
      }

      // Linea de escaneo: barre de adelante hacia atras y descansa un momento.
      // Sin animaciones (prefers-reduced-motion) no se muestra.
      let z = -99
      if (animado && m.escaner > 0.001 && medidas) {
        reloj.current = (reloj.current + delta) % 3.4
        const t = reloj.current / 2.6
        if (t <= 1) z = medidas.auto.max.z + 0.2 - t * (medidas.auto.max.z - medidas.auto.min.z + 0.4)
      }
      c.holo.uniforms.uBarrido.value = z
      if (barrido.current) {
        barrido.current.visible = z > -90
        barrido.current.position.z = z
        ;(barrido.current.material as MeshBasicMaterial).opacity = 0.32 * m.escaner
      }
    }

    // Luz de los faros (y de las traseras) sobre el piso.
    const fuera = 1 - m.plano
    if (pozoDelantero.current) {
      const mat = pozoDelantero.current.material as MeshBasicMaterial
      mat.opacity = (0.3 * l.faros + 0.3 * l.destello + 0.5 * rojo) * fuera
      mat.color.copy(rojo ? tmp.rojo : tmp.faro).lerp(rojo ? tmp.rojo : tmp.cian, m.escaner)
    }
    if (pozoTrasero.current) {
      const mat = pozoTrasero.current.material as MeshBasicMaterial
      mat.opacity = (0.4 * l.traseras + 0.5 * rojo) * fuera
    }

    // En el plano las ruedas no giran: es un dibujo.
    if (animado && m.plano < 0.5) for (const pieza of ruedas.current) pieza.rotation.x -= delta * 2.4

    // 4. Parallax: el auto se inclina unos grados hacia el cursor. Se aplica al
    // auto y no a la camara para no pelear con los controles de orbita.
    if (g) {
      const libre = animado && interactivo && !zonaActiva && !arrastrando && m.plano === 0
      const rx = libre ? -estado.pointer.y * 0.035 : 0
      const ry = -0.6 + (libre ? estado.pointer.x * 0.07 : 0)
      const t = Math.min(1, delta * 3)
      g.rotation.x += (rx - g.rotation.x) * t
      g.rotation.y += (ry - g.rotation.y) * t
      // "Rev": el auto vibra unos milimetros.
      const a = l.vibra * 0.012
      g.position.set(Math.sin(ahora * 83) * a * 0.6, Math.abs(Math.sin(ahora * 61)) * a, 0)
    }

    // 5. Camara. Si el acceso fue correcto, un dolly rapido hacia el auto
    // antes de cambiar de pagina.
    const saliendo = estadoAcceso === 'exito' && animado
    let acercar = 1
    if (saliendo) {
      if (!l.salida) l.salida = { t0: ahora, base: camera.position.clone(), objetivo: (ctrl ? ctrl.target : OBJETIVO_GENERAL).clone() }
      const k = Math.min(1, (ahora - l.salida.t0) / 0.6)
      acercar = 1 - 0.55 * k * k
    }
    const ancho = estado.size.width; const alto = estado.size.height
    const off = desplazamiento.current
    const tOff = animado ? 1 - Math.exp(-delta * 6) : 1
    off.x += (reserva.izquierda / 2 - off.x) * tOff
    off.y += (reserva.abajo / 2 - off.y) * tOff
    if (ctrl) ctrl.enabled = interactivo && m.plano === 0 && !saliendo

    if (m.plano > 0 && g && medidas) {
      // Plano: la camara pasa a la vista lateral izquierda mientras el campo
      // de vision se cierra de 30 a 2 grados (efecto dolly) y la distancia
      // crece en proporcion: el auto mantiene su tamano y la perspectiva
      // desaparece. Al llegar se cambia a una proyeccion ortografica exacta.
      if (!guardada.current) {
        guardada.current = { posicion: camera.position.clone(), objetivo: ctrl ? ctrl.target.clone() : OBJETIVO_GENERAL.clone() }
      }
      const s = guardada.current
      const a = medidas.auto
      // De la cota de alto (atras) a la etiqueta del diametro (adelante).
      const objetivoPlano = g.localToWorld(tmp.objetivo.set(0, 0.3, (a.min.z - 0.55 + a.max.z + 0.75) / 2))
      const lateral = tmp.lateral.set(1, 0, 0).transformDirection(g.matrixWorld).setY(0).normalize()
      const libreX = Math.max(0.2, (ancho - reserva.izquierda) / ancho)
      const libreY = Math.max(0.2, (alto - reserva.abajo) / alto)
      const anchoNecesario = a.max.z - a.min.z + 1.6
      const metaPlano = Math.max(anchoNecesario / (2 * tan(FOV) * (ancho / alto) * libreX), 2.9 / (2 * tan(FOV) * libreY))
      off.plano = off.plano ? off.plano + (metaPlano - off.plano) * tOff : metaPlano

      const dir0 = s.posicion.clone().sub(s.objetivo)
      const dist0 = dir0.length(); dir0.normalize()
      const w = m.plano
      // Si la camara esta del otro lado, pasa por encima del auto en arco.
      const arco = (1 - dir0.dot(lateral)) / 2
      const dir = dir0.lerp(lateral, w).add(new Vector3(0, Math.sin(Math.PI * w) * arco * 0.9, 0)).normalize()
      const fov = FOV * Math.pow(FOV_PLANO / FOV, w)
      const base = dist0 + (off.plano - dist0) * w
      const d = (base * tan(FOV) / tan(fov)) * acercar
      const objetivo = s.objetivo.clone().lerp(objetivoPlano, w)
      camera.position.copy(objetivo).addScaledVector(dir, d)
      camera.lookAt(objetivo)
      ctrl?.target.copy(objetivo)
      camera.fov = fov
    } else {
      if (guardada.current) {
        // Salida del plano: se recupera la camara de orbita tal como estaba.
        camera.position.copy(guardada.current.posicion)
        ctrl?.target.copy(guardada.current.objetivo)
        guardada.current = null
        off.plano = 0
      }
      camera.fov = FOV
      if (saliendo && l.salida) {
        camera.position.copy(l.salida.objetivo).lerp(l.salida.base, acercar)
        camera.lookAt(l.salida.objetivo)
        camera.fov = FOV + 14 * ((1 - acercar) / 0.55)
      } else if (vuelo.current && ctrl) {
        // Vuelo de camara suave (o inmediato si el visitante pidio menos movimiento).
        const t = animado ? 1 - Math.exp(-delta * 3) : 1
        camera.position.lerp(vuelo.current.posicion, t)
        ctrl.target.lerp(vuelo.current.objetivo, t)
        if (camera.position.distanceTo(vuelo.current.posicion) < 0.01) vuelo.current = null
      }
    }

    const objetivoActual = ctrl ? ctrl.target : OBJETIVO_GENERAL
    const dist = camera.position.distanceTo(objetivoActual)
    camera.near = Math.max(0.3, dist - 7)
    camera.far = dist + 40
    const niebla = scene.fog as Fog | null
    if (niebla) {
      niebla.color.copy(m.fondo)
      niebla.near = dist + 0.7 + m.plano * 60
      niebla.far = dist + 9.7 + m.plano * 90
    }
    // La zona elegida queda en el centro del area que no tapa la tarjeta.
    if (Math.abs(off.x) > 0.5 || Math.abs(off.y) > 0.5) camera.setViewOffset(ancho, alto, -off.x, off.y, ancho, alto)
    else if (camera.view?.enabled) camera.clearViewOffset()
    camera.updateProjectionMatrix()
    if (m.plano >= 0.999) {
      // Proyeccion ortografica con el mismo encuadre que la perspectiva de 2 grados.
      const arriba = camera.near * tan(camera.fov)
      const altoN = 2 * arriba; const anchoN = camera.aspect * altoN
      let izq = -anchoN / 2; let sup = arriba
      const v = camera.view
      if (v?.enabled) { izq += (v.offsetX * anchoN) / v.fullWidth; sup -= (v.offsetY * altoN) / v.fullHeight }
      const k = dist / camera.near
      camera.projectionMatrix.makeOrthographic(izq * k, (izq + anchoN) * k, sup * k, (sup - altoN) * k, camera.near, camera.far)
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
    }

    // 6. Puntos: se esconden cuando quedan detras del auto (se traza un rayo
    // desde la camara contra la carroceria y la cabina simplificadas) o de
    // espaldas a la camara. El activo informa donde cae en pantalla.
    if (!g || !medidas) return
    g.worldToLocal(tmp.camLocal.copy(camera.position))
    for (const p of medidas.puntos) {
      g.localToWorld(tmp.enMundo.copy(p.posicion))
      tmp.normal.copy(p.normal).transformDirection(g.matrixWorld)
      tmp.haciaCamara.copy(camera.position).sub(tmp.enMundo).normalize()
      // En el plano todos los puntos estan en la silueta lateral: solo cuenta el rayo.
      const deFrente = m.plano > 0.5 || tmp.normal.dot(tmp.haciaCamara) > -0.1
      const distancia = tmp.camLocal.distanceTo(p.posicion)
      tmp.rayo.origin.copy(tmp.camLocal)
      tmp.rayo.direction.copy(p.posicion).sub(tmp.camLocal).normalize()
      const tapado = medidas.oclusores.some((caja) => {
        const corte = tmp.rayo.intersectBox(caja, tmp.corte)
        return corte !== null && tmp.camLocal.distanceTo(corte) < distancia - 0.04
      })
      const visible = deFrente && !tapado
      const boton = botones.current.get(p.id)
      if (boton) boton.dataset.oculto = visible ? 'no' : 'si'
      if (p.id === zonaActiva && alProyectar) {
        const v = tmp.enMundo.clone().project(camera)
        alProyectar({ x: ((v.x + 1) / 2) * ancho, y: ((1 - v.y) / 2) * alto, visible: visible && v.z < 1 })
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
      {interactivo && medidas && (
        <>
          {medidas.puntos.map((p) => {
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
                  // El clic del raton no enfoca el boton: enfocar un elemento
                  // puede desplazar la pagina para mostrarlo (el teclado sigue
                  // pudiendo enfocarlo con Tab).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(p.id, true)}
                >
                  <span className="punto-zona-nucleo" aria-hidden />
                  <span className="punto-zona-etiqueta">{zona?.nombre}</span>
                </button>
              </Html>
            )
          })}
          {/* Indicadores del escaner: visibles solo en ese modo (por CSS). */}
          {medidas.indicadores.map((i) => (
            <Html key={i.id} position={i.posicion} center zIndexRange={[9, 0]} className="html-pasivo">
              <div className={`indicador-diag indicador-${i.id}`} aria-hidden>
                <span className="indicador-etiqueta">{i.etiqueta}</span>
                <span className="indicador-valor">{i.valor}</span>
              </div>
            </Html>
          ))}
          <LineasGuia medidas={medidas} mezcla={mezcla} />
          <PozoLuz refMalla={pozoDelantero} z={medidas.auto.max.z + 1.0} ancho={2.6} largo={2.4} color="#dce9ff" />
          <PozoLuz refMalla={pozoTrasero} z={medidas.auto.min.z - 0.55} ancho={2.2} largo={1.2} color={ROJO_ALERTA} />
          <LineaBarrido refMalla={barrido} medidas={medidas} />
          <Cotas medidas={medidas} mezcla={mezcla} />
          <Rejilla mezcla={mezcla} />
        </>
      )}
    </group>
  )
}

/** Charco de luz en el piso, delante (faros) o detras (luces traseras) del auto. */
function PozoLuz({ refMalla, z, ancho, largo, color }: {
  refMalla: MutableRefObject<Mesh | null>; z: number; ancho: number; largo: number; color: string
}) {
  const textura = useMemo(() => texturaRadial(128, (t) => Math.exp(-4 * t * t) * (1 - t)), [])
  return (
    <mesh ref={refMalla} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, z]} renderOrder={3}>
      <planeGeometry args={[ancho, largo]} />
      <meshBasicMaterial map={textura} color={color} transparent opacity={0} blending={AdditiveBlending}
                         depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/**
 * Lineas que unen un indicador del escaner con la pieza a la que se refiere.
 * Line de drei (Line2) tiene grosor en pixeles: una linea comun de 1 px se
 * perdia sobre el holograma.
 */
function LineasGuia({ medidas, mezcla }: { medidas: Medidas; mezcla: MutableRefObject<Mezcla> }) {
  const lineas = useRef<(Line2 | null)[]>([])
  const extremos = useRef<(MeshBasicMaterial | null)[]>([])
  const conAncla = medidas.indicadores.filter((i): i is typeof i & { ancla: Vector3 } => Boolean(i.ancla))
  useFrame(() => {
    const e = mezcla.current.escaner
    for (const m of extremos.current) {
      if (!m) continue
      m.visible = e > 0.01
      m.opacity = e
    }
    for (const l of lineas.current) {
      if (!l) continue
      l.visible = e > 0.01
      l.material.opacity = e * 0.95
    }
  })
  return (
    <>
      {conAncla.map((i, n) => (
        <group key={i.id}>
          <Line
            ref={(el) => { lineas.current[n] = el as Line2 | null }}
            points={[i.posicion, i.ancla]} color={CIAN} lineWidth={1.6} dashed dashSize={0.06} gapSize={0.035}
            transparent opacity={0} depthTest={false} toneMapped={false} renderOrder={21}
          />
          <mesh position={i.ancla} renderOrder={22}>
            <sphereGeometry args={[0.035, 12, 8]} />
            <meshBasicMaterial ref={(el) => { extremos.current[n] = el }} color="#ffffff" transparent
                               opacity={0} depthTest={false} toneMapped={false} fog={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Plano luminoso que acompana la linea de escaneo a traves del auto. */
function LineaBarrido({ refMalla, medidas }: { refMalla: MutableRefObject<Mesh | null>; medidas: Medidas }) {
  const textura = useMemo(() => {
    const lienzo = document.createElement('canvas')
    lienzo.width = 128; lienzo.height = 64
    const ctx = lienzo.getContext('2d')
    if (ctx) {
      const g = ctx.createRadialGradient(64, 32, 0, 64, 32, 64)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.6, 'rgba(255,255,255,0.35)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 64)
    }
    return new CanvasTexture(lienzo)
  }, [])
  const a = medidas.auto
  return (
    <mesh ref={refMalla} position={[0, (a.max.y + a.min.y) / 2, 0]} visible={false} renderOrder={5}>
      <planeGeometry args={[a.max.x - a.min.x + 0.5, a.max.y - a.min.y + 0.35]} />
      <meshBasicMaterial map={textura} color={CIAN} transparent opacity={0} blending={AdditiveBlending}
                         depthWrite={false} side={DoubleSide} toneMapped={false} fog={false} />
    </mesh>
  )
}

/**
 * Cotas del plano, dibujadas en el costado izquierdo del auto (el que mira la
 * camara): largo total, distancia entre ejes, alto y diametro de rueda. Las
 * medidas salen del propio modelo, en milimetros.
 */
/** Altura (bajo el piso) de las lineas de cota de largo y de distancia entre ejes. */
const yLargo = -0.28
const yEjes = -0.56

function Cotas({ medidas, mezcla }: { medidas: Medidas; mezcla: MutableRefObject<Mezcla> }) {
  const material = useRef<LineBasicMaterial>(null)
  const { auto: a, ejeDelantero: zf, ejeTrasero: zr, radioRueda: r, techoZ } = medidas
  const x = a.max.x + 0.05
  const zAlto = a.min.z - 0.35
  const geometria = useMemo(() => {
    const s: number[] = []
    const linea = (z1: number, y1: number, z2: number, y2: number) => s.push(x, y1, z1, x, y2, z2)
    const marca = (z: number, y: number) => linea(z - 0.05, y - 0.05, z + 0.05, y + 0.05)
    linea(a.min.z - 0.75, 0, a.max.z + 0.35, 0) // linea de piso
    // Largo total
    linea(a.min.z, yLargo, a.max.z, yLargo)
    for (const z of [a.min.z, a.max.z]) { linea(z, -0.04, z, yLargo - 0.08); marca(z, yLargo) }
    // Entre ejes
    linea(zr, yEjes, zf, yEjes)
    for (const z of [zr, zf]) { linea(z, -0.04, z, yEjes - 0.08); marca(z, yEjes) }
    // Alto
    linea(zAlto, 0, zAlto, a.max.y)
    linea(techoZ, a.max.y, zAlto - 0.08, a.max.y)
    marca(zAlto, 0); marca(zAlto, a.max.y)
    // Centros de rueda
    for (const z of [zr, zf]) { linea(z - 0.09, r, z + 0.09, r); linea(z, r - 0.09, z, r + 0.09) }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(s, 3))
    return geo
  }, [a, zf, zr, r, techoZ, x, zAlto])

  useFrame(() => {
    const m = material.current
    if (!m) return
    m.visible = mezcla.current.plano > 0.01
    m.opacity = mezcla.current.plano * 0.85
  })

  const mm = (v: number) => v.toLocaleString('es-CO')
  const etiquetas: [string, Vector3, string?][] = [
    [`Largo ${mm(medidas.mm.largo)}`, new Vector3(x, yLargo, (a.min.z + a.max.z) / 2)],
    [`Entre ejes ${mm(medidas.mm.ejes)}`, new Vector3(x, yEjes, (zf + zr) / 2)],
    [`Alto ${mm(medidas.mm.alto)}`, new Vector3(x, a.max.y / 2, zAlto), 'vertical'],
    [`Ø rueda ${mm(medidas.mm.rueda)}`, new Vector3(x, r, zf + r + 0.42)],
  ]
  return (
    <>
      <lineSegments geometry={geometria} renderOrder={20}>
        <lineBasicMaterial ref={material} color={TRAZO_PLANO} transparent opacity={0} depthTest={false}
                           depthWrite={false} toneMapped={false} fog={false} visible={false} />
      </lineSegments>
      {etiquetas.map(([texto, pos, clase]) => (
        <Html key={texto} position={pos} center zIndexRange={[9, 0]} className="html-pasivo">
          <span className={`cota-etiqueta ${clase ?? ''}`} aria-hidden>{texto}</span>
        </Html>
      ))}
    </>
  )
}

/** Cuadricula de papel milimetrado detras del auto, solo en el plano. */
function Rejilla({ mezcla }: { mezcla: MutableRefObject<Mezcla> }) {
  const material = useRef<MeshBasicMaterial>(null)
  const textura = useMemo(() => {
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = 128
    const ctx = lienzo.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      for (let i = 0; i < 128; i += 16) {
        ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, 128); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(128, i + 0.5); ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.strokeRect(0.5, 0.5, 127, 127)
    }
    const t = new CanvasTexture(lienzo)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(60, 30)
    return t
  }, [])
  useFrame(() => {
    const m = material.current
    if (!m) return
    m.visible = mezcla.current.plano > 0.01
    m.opacity = mezcla.current.plano * 0.16
  })
  return (
    <mesh position={[-2.5, 0.25, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={-1}>
      <planeGeometry args={[60, 30]} />
      <meshBasicMaterial ref={material} map={textura} color="#7fb0e6" transparent opacity={0}
                         depthWrite={false} toneMapped={false} fog={false} visible={false} />
    </mesh>
  )
}

/* ---------------------------------------------------------- escenario */

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

type MaterialPiso = Material & { emissive: Color; mixStrength?: number }

/**
 * Piso de showroom pulido. Su base es un color constante, el del fondo (no
 * se sombrea con la luz del estudio, que lo aclaraba en una mancha gris), y
 * solo se le suma el reflejo del auto. En el plano el reflejo se apaga.
 */
function Piso({ calidadAlta, mezcla }: { calidadAlta: boolean; mezcla: MutableRefObject<Mezcla> }) {
  const material = useRef<MaterialPiso>(null)
  useFrame(() => {
    const m = material.current
    if (!m) return
    m.emissive.copy(mezcla.current.fondo)
    if (m.mixStrength !== undefined) m.mixStrength = 7 * (1 - mezcla.current.plano)
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
      {/* Un circulo y no un plano infinito: a lo lejos dos superficies casi
          coplanares se pelean en el buffer de profundidad (z-fighting) y el
          piso asomaba como una franja gris en el horizonte. */}
      <circleGeometry args={[RADIO_PISO, 96]} />
      {calidadAlta ? (
        <MeshReflectorMaterial
          ref={material as never}
          blur={[160, 40]} resolution={1024} mixBlur={0.45} mixStrength={7} mixContrast={1.2}
          roughness={1} depthScale={0.8} minDepthThreshold={0.3} maxDepthThreshold={1.4}
          color="#000000" emissive={FONDO} emissiveIntensity={1} metalness={0} envMapIntensity={0}
          mirror={0.85}
        />
      ) : (
        // En equipos lentos el reflejo (otra pasada completa de la escena)
        // se cambia por un piso mate.
        <meshStandardMaterial ref={material as never} color="#000000" emissive={FONDO} roughness={0.85}
                              metalness={0} envMapIntensity={0.05} />
      )}
    </mesh>
  )
}

/** Degradado radial blanco; el color lo pone el material. */
function texturaRadial(lado: number, alfa: (t: number) => number): CanvasTexture {
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = lado
  const ctx = lienzo.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2)
    for (let i = 0; i <= 20; i++) g.addColorStop(i / 20, `rgba(255, 255, 255, ${alfa(i / 20).toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, lado, lado)
  }
  const textura = new CanvasTexture(lienzo)
  textura.colorSpace = SRGBColorSpace
  return textura
}

/**
 * Fundido del piso: transparente bajo el auto y del color exacto del fondo
 * hacia afuera (opaco antes del borde del piso, radio 7 de 12). Mas alla, el
 * mismo color liso hasta perderse de vista.
 */
function FundidoPiso({ mezcla }: { mezcla: MutableRefObject<Mezcla> }) {
  const textura = useMemo(() => texturaRadial(512, (t) => Math.min(1, Math.max(0, (t - 0.2) / 0.3))), [])
  const plano = useRef<MeshBasicMaterial>(null)
  const anillo = useRef<MeshBasicMaterial>(null)
  useFrame(() => {
    plano.current?.color.copy(mezcla.current.fondo)
    anillo.current?.color.copy(mezcla.current.fondo)
  })
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={2}>
        <planeGeometry args={[24, 24]} />
        <meshBasicMaterial ref={plano} map={textura} color={FONDO} transparent depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} renderOrder={2}>
        <ringGeometry args={[RADIO_PISO - 0.05, 70, 96]} />
        <meshBasicMaterial ref={anillo} color={FONDO} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </>
  )
}

/**
 * Halo tenue en el piso, debajo del auto: suma luz, no la tapa. Rojo en la
 * vista real, cian en el escaner y apagado en el plano.
 */
function Halo({ mezcla }: { mezcla: MutableRefObject<Mezcla> }) {
  const textura = useMemo(() => texturaRadial(256, (t) => 0.55 * Math.exp(-5 * t * t)), [])
  const material = useRef<MeshBasicMaterial>(null)
  const colores = useMemo(() => ({ rojo: new Color(ROJO_HALO), cian: new Color(CIAN) }), [])
  useFrame(() => {
    const m = material.current
    if (!m) return
    m.color.copy(colores.rojo).lerp(colores.cian, mezcla.current.escaner)
    m.opacity = 0.22 * (1 - mezcla.current.plano)
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} renderOrder={3}>
      <planeGeometry args={[8, 8]} />
      <meshBasicMaterial ref={material} map={textura} color={ROJO_HALO} transparent opacity={0.22}
                         blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Sombra de contacto; en el plano se apaga (un dibujo no tiene sombras). */
function Sombra({ mezcla }: { mezcla: MutableRefObject<Mezcla> }) {
  const grupo = useRef<Group>(null)
  useFrame(() => { if (grupo.current) grupo.current.visible = mezcla.current.plano < 0.5 })
  return (
    <group ref={grupo}>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={10} blur={2.6} far={2.2} resolution={512} />
    </group>
  )
}

export interface PropsCoche3D {
  animado: boolean
  /** false cuando la vitrina no esta a la vista: el render se detiene. */
  activo: boolean
  /** Con controles de orbita, parallax, puntos y modos (pagina de acceso). */
  interactivo?: boolean
  /** La rueda del raton hace zoom solo cuando el visitante ya interactuo con el auto. */
  zoomHabilitado?: boolean
  modo?: Modo
  zonaActiva?: IdZona | null
  reserva?: Reserva
  /** Estado del formulario de acceso, para que el auto reaccione. */
  acceso?: SenalAcceso
  alElegirZona?: (zona: IdZona) => void
  alProyectar?: (punto: PuntoEnPantalla) => void
  alCargar?: () => void
}

const SIN_RESERVA: Reserva = { izquierda: 0, abajo: 0 }

export default function Coche3D({
  animado, activo, interactivo = false, zoomHabilitado = false, modo = 'real', zonaActiva = null,
  reserva = SIN_RESERVA, acceso, alElegirZona, alProyectar, alCargar,
}: PropsCoche3D) {
  const [calidadAlta, setCalidadAlta] = useState(true)
  const [arrastrando, setArrastrando] = useState(false)
  const reanudar = useRef<number | undefined>(undefined)
  const mezcla = useRef<Mezcla>({
    objetivo: modo, crudo: { real: 1, escaner: 0, plano: 0 }, real: 1, escaner: 0, plano: 0, fondo: new Color(FONDO),
  })

  useEffect(() => { mezcla.current.objetivo = modo }, [modo])
  useEffect(() => () => window.clearTimeout(reanudar.current), [])

  return (
    <Canvas
      frameloop={activo ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [6.3, 1.55, 6.8], fov: FOV, near: 0.5, far: 80 }}
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
        minDistance={3}
        maxDistance={DISTANCIA_MAXIMA}
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
          animado={animado} interactivo={interactivo} mezcla={mezcla} zonaActiva={zonaActiva}
          reserva={reserva} arrastrando={arrastrando} acceso={acceso}
          alElegirZona={alElegirZona} alProyectar={alProyectar} alCargar={alCargar}
        />
        <Piso calidadAlta={calidadAlta} mezcla={mezcla} />
        <FundidoPiso mezcla={mezcla} />
        <Halo mezcla={mezcla} />
        <Sombra mezcla={mezcla} />

        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={0.6} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODELO, DRACO)
