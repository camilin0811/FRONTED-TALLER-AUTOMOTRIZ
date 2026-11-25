/*
 * Para qué sirve: Estado de la sesión (usuario, entrar y salir) disponible para toda la aplicación.
 * PATRÓN Provider (React Context): ProveedorAutenticacion publica la sesión en un Context de React.
 * PATRÓN Custom Hook (React): useAutenticacion() da acceso a ese contexto desde cualquier
 *     componente.
 * PATRÓN Observer (publicar/suscribir): escucha el evento 'sesion-expirada' que emite el cliente de
 *     la API y cierra la sesión.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { autenticacion } from '../api/servicios'
import { almacen, type Sesion } from './sesion'
import type { Rol } from '../api/tipos'

interface Contexto {
  sesion: Sesion | null
  entrar: (usuario: string, clave: string) => Promise<void>
  salir: () => void
  tieneRol: (...roles: Rol[]) => boolean
}

// PATRÓN Provider (React Context): contenedor de la sesión para todo el árbol.
const AutenticacionContexto = createContext<Contexto | null>(null)

export function ProveedorAutenticacion({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => almacen.leer())

  const salir = useCallback(() => {
    almacen.borrar()
    setSesion(null)
  }, [])

  // Si el token caduca o lo revocan, la capa de API avisa y la sesion se
  // cierra sola, en vez de dejar al usuario ante errores que no entiende.
  useEffect(() => {
    const alExpirar = () => salir()
    // PATRÓN Observer: suscripción al aviso de sesión expirada que emite api/cliente.ts.
    window.addEventListener('sesion-expirada', alExpirar)
    return () => window.removeEventListener('sesion-expirada', alExpirar)
  }, [salir])

  const entrar = useCallback(async (usuario: string, clave: string) => {
    const t = await autenticacion.login(usuario, clave)
    const nueva: Sesion = {
      token: t.token,
      usuario: t.usuario,
      rol: t.rol,
      nombre: t.nombre,
      expiraEn: Date.now() + t.expiraEnSegundos * 1000,
    }
    almacen.guardar(nueva)
    setSesion(nueva)
  }, [])

  const valor = useMemo<Contexto>(() => ({
    sesion,
    entrar,
    salir,
    tieneRol: (...roles: Rol[]) => !!sesion && roles.includes(sesion.rol),
  }), [sesion, entrar, salir])

  return <AutenticacionContexto.Provider value={valor}>{children}</AutenticacionContexto.Provider>
}

// PATRÓN Custom Hook: acceso a la sesión desde cualquier componente.
export function useAutenticacion() {
  const ctx = useContext(AutenticacionContexto)
  if (!ctx) throw new Error('useAutenticacion debe usarse dentro de ProveedorAutenticacion')
  return ctx
}
