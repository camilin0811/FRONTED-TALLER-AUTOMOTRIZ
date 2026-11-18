import { ETIQUETA_ROL } from './estados'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ProveedorAutenticacion, useAutenticacion } from './autenticacion/Contexto'
import { Guarda } from './autenticacion/Guarda'
import { PanelRecepcion } from './paginas/PanelRecepcion'
import { DetalleOrden } from './paginas/DetalleOrden'
import { PortalCliente } from './paginas/PortalCliente'
import { VistaMecanico } from './paginas/VistaMecanico'
import { Inventario } from './paginas/Inventario'
import { Login } from './paginas/Login'
import { NoEncontrada } from './paginas/NoEncontrada'

export default function App() {
  return (
    <ProveedorAutenticacion>
      <Routes>
        {/* Publicas, sin el menu interno del taller */}
        <Route path="/portal" element={<PortalCliente />} />
        <Route path="/acceso" element={<Login />} />

        {/* Internas: solo estas rutas llevan el menu lateral */}
        <Route element={<Interno />}>
          <Route path="/" element={<Navigate to="/recepcion" replace />} />
          <Route path="/recepcion" element={
            <Guarda roles={['RECEPCIONISTA', 'ADMINISTRADOR']}><PanelRecepcion /></Guarda>} />
          <Route path="/ordenes/:id" element={
            <Guarda roles={['RECEPCIONISTA', 'ADMINISTRADOR']}><DetalleOrden /></Guarda>} />
          <Route path="/mecanico" element={
            <Guarda roles={['MECANICO', 'ADMINISTRADOR']}><VistaMecanico /></Guarda>} />
          <Route path="/inventario" element={
            <Guarda roles={['RECEPCIONISTA', 'MECANICO', 'ADMINISTRADOR']}><Inventario /></Guarda>} />
        </Route>

        {/* Cualquier otra direccion: pagina propia, no un salto al login */}
        <Route path="*" element={<NoEncontrada />} />
      </Routes>
    </ProveedorAutenticacion>
  )
}

function Interno() {
  return (
    <div className="app">
      <Lateral />
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}

function Lateral() {
  const { sesion, salir, tieneRol } = useAutenticacion()
  const activo = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '')

  return (
    <aside className="lateral">
      <h1>Taller</h1>
      <p className="lema">Racing service</p>
      <nav>
        {/* El menu solo muestra lo que el rol puede abrir. Quien decide de
            verdad es el backend; esto evita callejones sin salida. */}
        {tieneRol('RECEPCIONISTA', 'ADMINISTRADOR') && (
          <NavLink to="/recepcion" className={activo}>Tablero</NavLink>
        )}
        {tieneRol('MECANICO', 'ADMINISTRADOR') && (
          <NavLink to="/mecanico" className={activo}>Mi trabajo</NavLink>
        )}
        {tieneRol('RECEPCIONISTA', 'MECANICO', 'ADMINISTRADOR') && (
          <NavLink to="/inventario" className={activo}>Inventario</NavLink>
        )}
        <NavLink to="/portal">Portal del cliente</NavLink>
      </nav>

      {sesion && (
        <div className="usuario">
          <div className="nombre">{sesion.nombre}</div>
          <div className="rol">{ETIQUETA_ROL[sesion.rol]}</div>
          <button className="salir" onClick={salir}>Cerrar sesión</button>
        </div>
      )}
    </aside>
  )
}
