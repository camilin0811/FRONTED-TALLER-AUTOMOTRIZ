import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAutenticacion } from '../autenticacion/Contexto'
import { AvisoError } from '../componentes/Aviso'

export function Login() {
  const { entrar } = useAutenticacion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [entrando, setEntrando] = useState(false)

  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/recepcion'

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setEntrando(true)
    setError(null)
    try {
      await entrar(usuario, clave)
      navegar(destino, { replace: true })
    } catch (e) {
      setError(e)
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="pantalla-acceso">
      <form className="tarjeta-acceso" onSubmit={enviar}>
        <h1>Taller Automotriz</h1>
        <p className="tenue">Ingrese con sus credenciales del taller.</p>

        <AvisoError error={error} />

        <div className="campo">
          <label htmlFor="usuario">Usuario</label>
          <input id="usuario" value={usuario} autoComplete="username" required autoFocus
                 onChange={(e) => setUsuario(e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="clave">Clave</label>
          <input id="clave" type="password" value={clave} autoComplete="current-password" required
                 onChange={(e) => setClave(e.target.value)} />
        </div>

        <button className="primario" type="submit" disabled={entrando} style={{ width: '100%' }}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="tenue" style={{ marginTop: 18, textAlign: 'center' }}>
          ¿Es cliente? <a href="/portal">Consulte su vehículo aquí</a>
        </p>
      </form>
    </div>
  )
}
