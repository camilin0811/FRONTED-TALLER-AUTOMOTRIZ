/**
 * Esqueleto de carga: en lugar de un letrero, la pagina insinua su propia
 * forma (titulo, tarjetas, filas) mientras llegan los datos.
 */
export function Cargando({ que = 'información' }: { que?: string }) {
  return (
    <div className="esqueleto" role="status" aria-label={`Cargando ${que}…`}>
      <div className="hueso titulo" />
      <div className="hueso bloque" />
      <div className="hueso" />
      <div className="hueso media" />
      <div className="hueso" />
    </div>
  )
}

/** Todo listado define que mostrar cuando no hay datos. */
export function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="vacio">{children}</div>
}
