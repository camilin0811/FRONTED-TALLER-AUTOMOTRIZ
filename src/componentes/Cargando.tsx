export function Cargando({ que = 'información' }: { que?: string }) {
  return <div className="cargando" role="status">Cargando {que}…</div>
}

/** Todo listado define que mostrar cuando no hay datos. */
export function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="vacio">{children}</div>
}
