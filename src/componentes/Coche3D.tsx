import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, MeshReflectorMaterial, useGLTF } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Box3, MeshPhysicalMaterial, MeshStandardMaterial, Vector3 } from 'three'
import type { Group, Material, Mesh } from 'three'

/**
 * Vitrina 3D del taller: un deportivo CC0 (Quaternius, via Poly Pizza) con
 * materiales PBR aplicados en tiempo de ejecucion, luz de estudio HDRI,
 * piso reflectante y un posprocesado sutil.
 *
 * Todo se sirve desde /public: el modelo comprimido con Draco (25 KB), el
 * decodificador y el HDRI. En tiempo de ejecucion no se toca ningun CDN.
 *
 * Este modulo solo se carga de forma diferida desde CocheEscaparate, que es
 * quien decide si hay WebGL y si el visitante tolera movimiento.
 */

const MODELO = '/models/deportivo.glb'
const DRACO = '/draco/'

/* Los materiales del GLB traen nombres semanticos (Orange, Windows,
   TailLights...). Aqui cada uno se sustituye por su version fisica:
   la pintura es metalica con laca, el vidrio refleja, el caucho no. */
function materialPara(nombre: string): Material | null {
  switch (nombre) {
    case 'White': // carroceria del SportsCar2
    case 'Orange':
      return new MeshPhysicalMaterial({
        color: '#b40a0a', metalness: 0.7, roughness: 0.32,
        clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.65,
      })
    case 'DarkOrange':
      return new MeshPhysicalMaterial({
        color: '#7e0606', metalness: 0.7, roughness: 0.38,
        clearcoat: 0.8, clearcoatRoughness: 0.16, envMapIntensity: 0.6,
      })
    case 'Windows':
      return new MeshPhysicalMaterial({
        color: '#0b1016', metalness: 0.2, roughness: 0.06,
        clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.8,
      })
    case 'Grey': // rines
      return new MeshStandardMaterial({ color: '#b9c1ca', metalness: 0.9, roughness: 0.35, envMapIntensity: 0.7 })
    case 'Headlights':
      return new MeshStandardMaterial({
        color: '#e8f1fb', emissive: '#9fc4ff', emissiveIntensity: 1.4,
        metalness: 0.1, roughness: 0.2,
      })
    case 'TailLights': // encendidas: el bloom las hace brillar
      return new MeshStandardMaterial({
        color: '#ff2020', emissive: '#ff0808', emissiveIntensity: 3.2,
        metalness: 0.1, roughness: 0.3,
      })
    case 'Black': // caucho
      return new MeshStandardMaterial({ color: '#0b0b0c', metalness: 0, roughness: 0.95 })
    default:
      return null
  }
}

function Deportivo({ animado }: { animado: boolean }) {
  const gltf = useGLTF(MODELO, DRACO)
  const plato = useRef<Group>(null)
  const ruedas = useRef<Mesh[]>([])
  // Eje del giro de las ruedas, en el espacio local del modelo.
  const ejeRueda = useRef<'x' | 'z'>('x')

  // Clon propio: varias instancias (acceso y portal) no deben compartir
  // transformaciones ni materiales.
  const escena = useMemo(() => {
    const copia = gltf.scene.clone(true)
    copia.traverse((objeto) => {
      const malla = objeto as Mesh
      if (!malla.isMesh) return
      malla.castShadow = true
      const aplicar = (m: Material) => materialPara(m.name) ?? m
      malla.material = Array.isArray(malla.material)
        ? malla.material.map(aplicar)
        : aplicar(malla.material)
    })
    return copia
  }, [gltf])

  // Normaliza el modelo: escala conocida, centrado y ruedas sobre el piso.
  // Asi un cambio de modelo no obliga a recalibrar la camara.
  useLayoutEffect(() => {
    escena.position.set(0, 0, 0)
    escena.scale.setScalar(1)
    const caja = new Box3().setFromObject(escena)
    const tamano = caja.getSize(new Vector3())
    escena.scale.setScalar(3.9 / Math.max(tamano.x, tamano.z))
    caja.setFromObject(escena)
    const centro = caja.getCenter(new Vector3())
    escena.position.set(-centro.x, -caja.min.y, -centro.z)

    // Ruedas: el pivote se hornea en la geometria. El origen de cada malla
    // pasa a ser el centro de su propia rueda y la posicion lo compensa,
    // de modo que girar la malla es girar sobre el eje real. Todo ocurre en
    // el espacio local del modelo: ninguna rotacion del plato ni matriz de
    // mundo puede contaminar el calculo (el enfoque anterior, con grupos
    // colocados a partir de cajas en coordenadas de mundo, hacia orbitar a
    // las ruedas traseras como una helice).
    ruedas.current = []
    escena.traverse((objeto) => {
      const malla = objeto as Mesh
      if (!malla.isMesh || !/wheel/i.test(malla.name)) return
      if (!malla.userData.pivoteHorneado) {
        // La geometria se clona: el GLB cacheado la comparte entre las
        // instancias del acceso y del portal, y trasladarla dos veces la
        // descolocaria.
        malla.geometry = malla.geometry.clone()
        malla.geometry.computeBoundingBox()
        const cajaRueda = malla.geometry.boundingBox
        if (!cajaRueda) return
        const centroRueda = cajaRueda.getCenter(new Vector3())
        malla.geometry.translate(-centroRueda.x, -centroRueda.y, -centroRueda.z)
        malla.position.add(centroRueda)
        malla.userData.pivoteHorneado = true

        // El eje del giro es la dimension mas corta de una rueda suelta
        // (el espesor del cilindro). El nodo trasero trae las dos ruedas
        // juntas, asi que solo las delanteras sirven para medirlo.
        if (/front/i.test(malla.name)) {
          const dim = cajaRueda.getSize(new Vector3())
          ejeRueda.current = dim.x <= dim.z ? 'x' : 'z'
        }
      }
      ruedas.current.push(malla)
    })
  }, [escena])

  useFrame((estado, delta) => {
    if (!animado) return
    if (plato.current) plato.current.rotation.y += delta * 0.28
    for (const rueda of ruedas.current) rueda.rotation[ejeRueda.current] -= delta * 2.2
    // La camara acompana al cursor apenas unos centimetros: presencia, no mareo.
    const camara = estado.camera
    camara.position.x += (4.4 + estado.pointer.x * 0.5 - camara.position.x) * 0.05
    camara.position.y += (1.7 + estado.pointer.y * 0.3 - camara.position.y) * 0.05
    camara.lookAt(0, 0.55, 0)
  })

  return (
    <group ref={plato} rotation={[0, 0.65, 0]}>
      <primitive object={escena} />
    </group>
  )
}

function Piso() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
      <circleGeometry args={[8, 48]} />
      <MeshReflectorMaterial
        blur={[280, 80]}
        resolution={512}
        mixBlur={0.9}
        mixStrength={8}
        roughness={0.65}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.3}
        color="#0a0c10"
        metalness={0.5}
        mirror={0.55}
      />
    </mesh>
  )
}

export default function Coche3D({ animado }: { animado: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [4.4, 1.7, 4.8], fov: 30 }}
      /* Si el coche no puede dibujarse, mejor nada que un lienzo roto. */
      fallback={<div className="coche-fallback" aria-hidden />}
      aria-hidden
    >
      <Suspense fallback={null}>
        {/* Luz de estudio: el HDRI ilumina y los reflejos salen de el.
            La puntual solo recorta el contorno y proyecta la sombra. */}
        <Environment files="/hdr/estudio.hdr" />
        <spotLight position={[6, 8, 4]} angle={0.4} penumbra={0.7} intensity={32} castShadow />

        <Deportivo animado={animado} />
        <Piso />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={10} blur={2.2} far={2.2} />

        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={0.7} />
          <Vignette offset={0.25} darkness={0.72} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}

useGLTF.preload(MODELO, DRACO)
