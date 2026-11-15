import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PanelRecepcion } from './paginas/PanelRecepcion'
import { DetalleOrden } from './paginas/DetalleOrden'
import { PortalCliente } from './paginas/PortalCliente'
import { VistaMecanico } from './paginas/VistaMecanico'
import { Inventario } from './paginas/Inventario'

/** El portal del cliente no lleva el menu interno del taller. */
const SIN_LATERAL = ['/portal']

export default function App() {
  const { pathname } = useLocation()
  const soloContenido = SIN_LATERAL.some((p) => pathname.startsWith(p))

  if (soloContenido) {
    return (
      <Routes>
        <Route path="/portal" element={<PortalCliente />} />
      </Routes>
    )
  }

  return (
    <div className="app">
      <aside className="lateral">
        <h1>TALLER</h1>
        <nav>
          <NavLink to="/recepcion" className={({ isActive }) => (isActive ? 'activo' : '')}>
            Tablero
          </NavLink>
          <NavLink to="/mecanico" className={({ isActive }) => (isActive ? 'activo' : '')}>
            Mi trabajo
          </NavLink>
          <NavLink to="/inventario" className={({ isActive }) => (isActive ? 'activo' : '')}>
            Inventario
          </NavLink>
          <NavLink to="/portal">Portal del cliente</NavLink>
        </nav>
      </aside>

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Navigate to="/recepcion" replace />} />
          <Route path="/recepcion" element={<PanelRecepcion />} />
          <Route path="/ordenes/:id" element={<DetalleOrden />} />
          <Route path="/mecanico" element={<VistaMecanico />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="*" element={<Navigate to="/recepcion" replace />} />
        </Routes>
      </main>
    </div>
  )
}
