/*
 * Para qué sirve: Página de acceso: formulario "Pit de acceso", vitrina 3D y sección de servicios.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAutenticacion } from '../autenticacion/Contexto'
import { AvisoError } from '../componentes/Aviso'
import { CocheEscaparate, type SenalAcceso } from '../componentes/CocheEscaparate'

/** Duracion del dolly de la camara antes de cambiar de pagina. */
const DOLLY_MS = 650

/** Tacometro del boton Entrar: la aguja sube y baja mientras se valida. */
function Tacometro() {
  return (
    <svg className="tacometro" viewBox="0 0 30 19" aria-hidden>
      <path className="arco" d="M3 16 A12 12 0 0 1 25.4 10" />
      <path className="zona-roja" d="M25.4 10 A12 12 0 0 1 27 16" />
      <line className="aguja" x1="15" y1="16" x2="15" y2="6" />
      <circle className="eje" cx="15" cy="16" r="2" />
    </svg>
  )
}
import { SERVICIOS, type Servicio } from '../servicios'

/** Iconos de la seccion de servicios (SVG en linea); los textos viven en src/servicios.ts. */
const ICONOS: Record<Servicio['id'], React.ReactNode> = {
  diagnostico: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="3" width="16" height="12" rx="2" />
        <path d="M8 7h4M8 10h8M9 15v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2" />
      </svg>
  ),
  mantenimiento: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.9 2.9-2.1-2.1 2.9-2.9Z" />
      </svg>
  ),
  competicion: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2M12 3v2M21 12h-2M12 21v-2M3 12h2" />
      </svg>
  ),
  motocicletas: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="5.5" cy="17" r="3.2" />
        <circle cx="18.5" cy="17" r="3.2" />
        <path d="M5.5 17 9 10h4l2.5 4M13 10l-1.5-3H9M15.5 14h3" />
      </svg>
  ),
}

export function Login() {
  const { entrar } = useAutenticacion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [entrando, setEntrando] = useState(false)
  // true cuando la peticion lleva mas de 3 segundos: el servidor del plan
  // gratuito estaba dormido y esta arrancando.
  const [arrancando, setArrancando] = useState(false)
  // Lo que ve el auto del formulario: foco, clave, envio y resultado.
  const [foco, setFoco] = useState(false)
  const [fase, setFase] = useState<'formulario' | 'entrando' | 'exito' | 'error'>('formulario')
  const [pulso, setPulso] = useState(0)
  const formulario = useRef<HTMLFormElement>(null)
  const animado = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const senal: SenalAcceso = {
    estado: fase !== 'formulario' ? fase : clave ? 'clave' : foco || usuario ? 'usuario' : 'reposo',
    pulso,
  }

  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/recepcion'

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setEntrando(true)
    setFase('entrando')
    setError(null)
    const avisoLento = window.setTimeout(() => setArrancando(true), 3000)
    try {
      await entrar(usuario, clave)
      // Acceso correcto: la camara hace un dolly hacia el auto y luego se
      // cambia de pagina. Sin animaciones, se cambia de inmediato.
      if (animado) {
        setFase('exito')
        await new Promise((listo) => window.setTimeout(listo, DOLLY_MS))
      }
      navegar(destino, { replace: true })
    } catch (e) {
      setError(e)
      setFase('error')
      // Las luces parpadean en rojo y el formulario se sacude.
      if (animado) {
        formulario.current?.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' },
           { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
          { duration: 450, easing: 'ease-out' },
        )
      }
      window.setTimeout(() => setFase((f) => (f === 'error' ? 'formulario' : f)), 1500)
    } finally {
      window.clearTimeout(avisoLento)
      setArrancando(false)
      setEntrando(false)
    }
  }

  return (
    <div className="landing">
      <header className="barra-landing">
        <div className="marca-barra">
          <span className="logo-caja" aria-hidden>TA</span>
          <span>Taller Automotriz</span>
        </div>
        <a className="enlace-barra" href="/portal">Portal del cliente</a>
      </header>

      <main className="heroe">
        <section className="heroe-info">
          <p className="lema-heroe">Racing service · Automóviles y motocicletas</p>
          <h1>
            Precisión de competición <em>para tu vehículo</em>
          </h1>
          <p className="subtitulo">
            Diagnóstico computarizado, mantenimiento y preparación con seguimiento
            en línea de cada orden de trabajo.
          </p>

          <CocheEscaparate className="heroe-coche" interactivo acceso={senal} />

          <dl className="metricas">
            <div>
              <dt>12+</dt>
              <dd>años de experiencia</dd>
            </div>
            <div>
              <dt>4.800</dt>
              <dd>vehículos atendidos</dd>
            </div>
            <div>
              <dt>48 h</dt>
              <dd>tiempo promedio de servicio</dd>
            </div>
          </dl>
        </section>

        <form className="tarjeta-acceso vidrio" onSubmit={enviar} ref={formulario}
              onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}>
          <h2 className="titulo-acceso">Pit de acceso</h2>
          <p className="tenue">Ingrese con sus credenciales del taller.</p>

          <AvisoError error={error} />

          <div className="campo">
            <label htmlFor="usuario">Usuario</label>
            <input id="usuario" value={usuario} autoComplete="username" required
                   onChange={(e) => setUsuario(e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="clave">Clave</label>
            <input id="clave" type="password" value={clave} autoComplete="current-password" required
                   onChange={(e) => { setClave(e.target.value); setPulso((n) => n + 1) }} />
          </div>

          <button className="primario boton-entrar" type="submit" disabled={entrando} style={{ width: '100%' }}>
            {entrando ? <><Tacometro /><span>Entrando…</span></> : 'Entrar'}
          </button>

          {arrancando && (
            <div className="arrancando" role="status">
              <span className="girando" aria-hidden />
              <div>
                <strong>Encendiendo motores…</strong>
                <p>
                  El servidor estaba en reposo y está arrancando. Puede tardar
                  hasta un minuto; no cierre la página.
                </p>
              </div>
            </div>
          )}

          <p className="tenue" style={{ marginTop: 18, textAlign: 'center', marginBottom: 0 }}>
            ¿Es cliente? <a href="/portal">Consulte su vehículo aquí</a>
          </p>
        </form>
      </main>

      <section className="servicios" aria-labelledby="titulo-servicios">
        <h2 id="titulo-servicios">Servicios</h2>
        <div className="rejilla-servicios">
          {SERVICIOS.map((s, i) => (
            <article className="tarjeta-servicio" key={s.titulo} style={{ animationDelay: `${i * 90}ms` }}>
              <div className="icono-servicio">{ICONOS[s.id]}</div>
              <h3>{s.titulo}</h3>
              <p>{s.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="pie">
        <div className="marca-barra">
          <span className="logo-caja" aria-hidden>TA</span>
          <span>Taller Automotriz</span>
        </div>
        <p className="tenue">
          Sistema de gestión del taller · <a href="/portal">Consulta de órdenes</a>
        </p>
        {/* Atribucion exigida por la licencia CC BY 4.0 del modelo 3D.
            Detalle completo en /models/CREDITS.md. */}
        <p className="creditos tenue">
          Modelo 3D: «<a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept"
                         target="_blank" rel="noopener noreferrer">Car Concept</a>» de Eric Chadwick
          (© 2024 Darmstadt Graphics Group GmbH), basado en un modelo de dominio público de Unity Fan.
          Licencia <a href="https://creativecommons.org/licenses/by/4.0/deed.es" target="_blank"
                      rel="noopener noreferrer">CC BY 4.0</a>. Modificado: sin logos ni variantes de pintura.
        </p>
      </footer>
    </div>
  )
}
