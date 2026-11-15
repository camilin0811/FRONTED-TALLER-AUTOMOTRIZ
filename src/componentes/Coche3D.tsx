import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import type { Group, Mesh, PlaneGeometry } from 'three'

/**
 * Monoplaza de carreras generico, construido con geometrias de three.js.
 *
 * Es un diseño original hecho de cajas, cilindros y conos: no reproduce
 * ningun coche real ni lleva marcas. Al ser geometria pura pesa cero bytes
 * de descarga extra (no hay modelo .glb que traer) y se dibuja en cualquier
 * equipo modesto.
 *
 * Este modulo solo se carga de forma diferida desde CocheEscaparate, que es
 * quien decide si hay WebGL y si el visitante tolera movimiento.
 */

/* Materiales como constantes. La librea es rosso corsa con acentos amarillos,
   al estilo de la escuderia italiana; sin escudos ni nombres, que son marca
   registrada: lo que identifica es el color, y ese no es de nadie. */
const PINTURA = { color: '#d40000', metalness: 0.45, roughness: 0.3 }
const GIALLO = { color: '#ffcf00', metalness: 0.3, roughness: 0.4 }
const CARBONO = { color: '#15181d', metalness: 0.3, roughness: 0.55 }
const GOMA = { color: '#121212', metalness: 0, roughness: 0.95 }
const LLANTA = { color: '#b9c1ca', metalness: 0.85, roughness: 0.35 }

function Rueda({ posicion, ancho }: { posicion: [number, number, number]; ancho: number }) {
  return (
    <group position={posicion} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.34, 0.34, ancho, 24]} />
        <meshStandardMaterial {...GOMA} />
      </mesh>
      {/* Disco de la llanta a cada lado */}
      <mesh position={[0, ancho / 2 + 0.005, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 20]} />
        <meshStandardMaterial {...LLANTA} />
      </mesh>
      <mesh position={[0, -ancho / 2 - 0.005, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 20]} />
        <meshStandardMaterial {...LLANTA} />
      </mesh>
    </group>
  )
}

function Monoplaza({ animado }: { animado: boolean }) {
  const grupo = useRef<Group>(null)

  // Giro lento de plato de exhibicion. Si el visitante pidio menos
  // movimiento, el coche queda quieto en un angulo que lo muestra bien.
  useFrame((_, delta) => {
    if (animado && grupo.current) grupo.current.rotation.y += delta * 0.3
  })

  return (
    <group ref={grupo} rotation={[0, 0.7, 0]}>
      {/* Casco central: del morro a la cola */}
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[0.62, 0.3, 2.6]} />
        <meshStandardMaterial {...PINTURA} />
      </mesh>

      {/* Morro: cono aplastado que remata adelante */}
      <mesh castShadow position={[0, 0.28, 1.72]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]}>
        <coneGeometry args={[0.3, 0.85, 4, 1]} />
        <meshStandardMaterial {...PINTURA} />
      </mesh>

      {/* Pontones laterales */}
      <mesh castShadow position={[0.55, 0.26, -0.25]}>
        <boxGeometry args={[0.5, 0.24, 1.3]} />
        <meshStandardMaterial {...PINTURA} />
      </mesh>
      <mesh castShadow position={[-0.55, 0.26, -0.25]}>
        <boxGeometry args={[0.5, 0.24, 1.3]} />
        <meshStandardMaterial {...PINTURA} />
      </mesh>

      {/* Cabina y reposacabezas */}
      <mesh castShadow position={[0, 0.5, 0.15]}>
        <boxGeometry args={[0.42, 0.18, 0.7]} />
        <meshStandardMaterial {...CARBONO} />
      </mesh>
      <mesh castShadow position={[0, 0.58, -0.35]}>
        <boxGeometry args={[0.3, 0.26, 0.34]} />
        <meshStandardMaterial {...PINTURA} />
      </mesh>

      {/* Toma de aire sobre la cabina */}
      <mesh castShadow position={[0, 0.72, -0.62]}>
        <boxGeometry args={[0.2, 0.18, 0.5]} />
        <meshStandardMaterial {...CARBONO} />
      </mesh>

      {/* Aleron delantero con sus derivas */}
      <mesh castShadow position={[0, 0.12, 1.95]}>
        <boxGeometry args={[1.5, 0.05, 0.4]} />
        <meshStandardMaterial {...CARBONO} />
      </mesh>
      <mesh position={[0.74, 0.2, 1.95]}>
        <boxGeometry args={[0.03, 0.2, 0.42]} />
        <meshStandardMaterial {...GIALLO} />
      </mesh>
      <mesh position={[-0.74, 0.2, 1.95]}>
        <boxGeometry args={[0.03, 0.2, 0.42]} />
        <meshStandardMaterial {...GIALLO} />
      </mesh>

      {/* Aleron trasero: dos soportes, plano alto y placas laterales */}
      <mesh position={[0, 0.55, -1.42]}>
        <boxGeometry args={[0.06, 0.34, 0.06]} />
        <meshStandardMaterial {...CARBONO} />
      </mesh>
      <mesh castShadow position={[0, 0.76, -1.45]}>
        <boxGeometry args={[1.18, 0.05, 0.34]} />
        <meshStandardMaterial {...CARBONO} />
      </mesh>
      <mesh position={[0.58, 0.62, -1.45]}>
        <boxGeometry args={[0.03, 0.34, 0.4]} />
        <meshStandardMaterial {...GIALLO} />
      </mesh>
      <mesh position={[-0.58, 0.62, -1.45]}>
        <boxGeometry args={[0.03, 0.34, 0.4]} />
        <meshStandardMaterial {...GIALLO} />
      </mesh>

      {/* Difusor trasero */}
      <mesh position={[0, 0.18, -1.38]}>
        <boxGeometry args={[0.7, 0.16, 0.3]} />
        <meshStandardMaterial {...CARBONO} />
      </mesh>

      <Rueda posicion={[0.78, 0.34, 1.15]} ancho={0.3} />
      <Rueda posicion={[-0.78, 0.34, 1.15]} ancho={0.3} />
      <Rueda posicion={[0.8, 0.34, -1.0]} ancho={0.38} />
      <Rueda posicion={[-0.8, 0.34, -1.0]} ancho={0.38} />
    </group>
  )
}

/* ----------------------------------------------------------- bandera */

const ANCHO_BANDERA = 4
const ALTO_BANDERA = 2.1

/**
 * Deforma el plano como tela al viento. La amplitud crece con la distancia
 * al mastil: el borde fijo no se mueve y la punta es la que flamea.
 */
function ondear(geometria: PlaneGeometry, tiempo: number) {
  const pos = geometria.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const avance = (x + ANCHO_BANDERA / 2) / ANCHO_BANDERA
    pos.setZ(i, Math.sin(x * 2.1 + tiempo * 2.6) * 0.32 * avance)
  }
  pos.needsUpdate = true
  geometria.computeVertexNormals()
}

function BanderaCuadros({ animado }: { animado: boolean }) {
  const malla = useRef<Mesh>(null)
  const tiempo = useRef(0)

  // La cuadricula se pinta una vez en un canvas: no hay imagen que descargar.
  const textura = useMemo(() => {
    const lienzo = document.createElement('canvas')
    lienzo.width = 320
    lienzo.height = 168
    const ctx = lienzo.getContext('2d')
    if (ctx) {
      const lado = 24
      for (let fila = 0; fila * lado < lienzo.height; fila++) {
        for (let col = 0; col * lado < lienzo.width; col++) {
          ctx.fillStyle = (fila + col) % 2 === 0 ? '#f2f2f2' : '#101010'
          ctx.fillRect(col * lado, fila * lado, lado, lado)
        }
      }
    }
    const resultado = new CanvasTexture(lienzo)
    resultado.colorSpace = SRGBColorSpace
    return resultado
  }, [])

  // Forma inicial: aunque no haya animacion, la bandera nunca aparece plana.
  useLayoutEffect(() => {
    if (malla.current) ondear(malla.current.geometry as PlaneGeometry, 0)
  }, [])

  useFrame((_, delta) => {
    if (!animado || !malla.current) return
    tiempo.current += delta
    ondear(malla.current.geometry as PlaneGeometry, tiempo.current)
  })

  return (
    <group position={[0.1, 1.35, -2.6]} rotation={[0, -0.12, 0]}>
      <mesh position={[-ANCHO_BANDERA / 2 - 0.05, -0.3, 0]}>
        <cylinderGeometry args={[0.035, 0.035, ALTO_BANDERA + 1.5, 12]} />
        <meshStandardMaterial color="#8a93a0" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh ref={malla}>
        <planeGeometry args={[ANCHO_BANDERA, ALTO_BANDERA, 40, 18]} />
        <meshStandardMaterial map={textura} side={DoubleSide} roughness={0.85} />
      </mesh>
    </group>
  )
}

export default function Coche3D({ animado }: { animado: boolean }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [3.6, 1.5, 4.2], fov: 32 }}
      /* Si el coche no puede dibujarse, mejor nada que un lienzo roto. */
      fallback={<div className="coche-fallback" aria-hidden />}
      aria-hidden
    >
      {/* Iluminacion de vitrina: una luz principal calida, un contorno rojo
          desde atras y un relleno frio para que el metal no muera en negro. */}
      <ambientLight intensity={0.55} />
      <spotLight position={[5, 7, 4]} angle={0.45} penumbra={0.6} intensity={220} castShadow />
      <directionalLight position={[-4, 2, -5]} color="#ff2d23" intensity={2.2} />
      <directionalLight position={[-3, 4, 3]} color="#9fb6d0" intensity={1.1} />

      <BanderaCuadros animado={animado} />
      <Monoplaza animado={animado} />
      <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={9} blur={2.4} far={2} />
    </Canvas>
  )
}
