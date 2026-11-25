/*
 * Para qué sirve: Página para direcciones que no existen.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import { Link } from 'react-router-dom'

/**
 * Pagina propia para rutas que no existen.
 *
 * Sin ella, una direccion mal escrita mandaba al tablero, que a su vez pedia
 * iniciar sesion: un cliente que buscaba el portal terminaba ante un login
 * que no es para el.
 */
export function NoEncontrada() {
  return (
    <main className="no-encontrada">
      <div>
        <p className="codigo-error">404</p>
        <h1>Página no encontrada</h1>
        <p>La dirección que buscó no existe o cambió de lugar.</p>
        <div className="acciones">
          <Link to="/" className="primario">Ir al inicio</Link>
          <Link to="/portal" className="secundario">Consultar mi vehículo</Link>
        </div>
      </div>
    </main>
  )
}
