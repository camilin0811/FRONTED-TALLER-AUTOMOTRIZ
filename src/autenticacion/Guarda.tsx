import { ETIQUETA_ROL } from '../estados'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { inicioDe } from './inicio'
import { useAutenticacion } from './Contexto'
import type { Rol } from '../api/tipos'
import { Aviso } from '../componentes/Aviso'

/**
 * Protege una ruta.
 *
 * Es comodidad para el usuario, no seguridad: quien decide de verdad es el
 * backend. Esconder un boton no impide llamar al endpoint.
 */
export function Guarda({ roles, children }: { roles?: Rol[]; children: React.ReactNode }) {
  const { sesion } = useAutenticacion()
  const ubicacion = useLocation()

  if (!sesion) {
    return <Navigate to="/acceso" replace state={{ desde: ubicacion.pathname }} />
  }

  if (roles && !roles.includes(sesion.rol)) {
    return (
      <>
        <Aviso tono="error" titulo="Sin permiso">
          Su rol ({ETIQUETA_ROL[sesion.rol]}) no tiene acceso a esta pantalla.
        </Aviso>
        <Link to={inicioDe(sesion.rol)} className="boton-enlace primario">Volver al tablero</Link>
      </>
    )
  }

  return <>{children}</>
}
