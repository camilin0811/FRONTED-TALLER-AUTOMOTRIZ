import { api } from './cliente'
import type {
  Mecanico, Movimiento, OrdenCompra, OrdenDetalle, OrdenResumen,
  Repuesto, Servicio, EstadoOrden, CanalAprobacion, Token, ConsultaPublica,
} from './tipos'

export const autenticacion = {
  login: (usuario: string, clave: string) =>
    api.post<Token>('/auth/login', { usuario, clave }),
  yo: () => api.get<{ usuario: string; nombre: string; rol: string; permisos: string[] }>('/auth/yo'),
  cambiarClave: (claveActual: string, claveNueva: string) =>
    api.post<void>('/auth/clave', { claveActual, claveNueva }),
}

/**
 * Unico endpoint sin token: exige placa y documento del titular.
 * Va por POST para que esos datos no queden en la URL, los registros de
 * acceso ni el historial del navegador.
 */
export const publico = {
  consultarOrden: (placa: string, documento: string) =>
    api.post<ConsultaPublica>('/publico/orden', { placa, documento }),
}

export const ordenes = {
  listar: (filtro: { estado?: EstadoOrden; placa?: string } = {}) => {
    const p = new URLSearchParams()
    if (filtro.estado) p.set('estado', filtro.estado)
    if (filtro.placa) p.set('placa', filtro.placa)
    const q = p.toString()
    return api.get<OrdenResumen[]>(`/ordenes${q ? `?${q}` : ''}`)
  },
  detalle: (id: string) => api.get<OrdenDetalle>(`/ordenes/${id}`),
  crear: (datos: { placa: string; kilometraje: number; motivo?: string }) =>
    api.post<OrdenDetalle>('/ordenes', datos),
  transicionar: (
    id: string,
    estado: EstadoOrden,
    extra: { idMecanico?: string; motivo?: string; canal?: CanalAprobacion } = {},
  ) => api.patch<OrdenDetalle>(`/ordenes/${id}/estado`, { estado, ...extra }),
  agregarServicio: (id: string, codigo: string) =>
    api.post<OrdenDetalle>(`/ordenes/${id}/servicios?codigo=${encodeURIComponent(codigo)}`),
  registrarRepuesto: (id: string, codigo: string, cantidad: number) =>
    api.post<OrdenDetalle>(`/ordenes/${id}/repuestos`, { codigo, cantidad }),
  registrarDiagnostico: (
    id: string,
    datos: { usarEscaner: boolean; codigosFalla: string[]; observaciones: string },
  ) => api.post<OrdenDetalle>(`/ordenes/${id}/diagnosticos`, datos),
}

export const inventario = {
  listar: (bajoMinimo = false) => api.get<Repuesto[]>(`/repuestos?bajoMinimo=${bajoMinimo}`),
  movimientos: (codigo: string) => api.get<Movimiento[]>(`/repuestos/${codigo}/movimientos`),
  ordenesCompra: () => api.get<OrdenCompra[]>('/ordenes-compra'),
  /** Solo administrador, mientras la orden es borrador. */
  ajustarCantidad: (id: string, codigo: string, cantidad: number) =>
    api.patch<OrdenCompra>(`/ordenes-compra/${id}/items/${encodeURIComponent(codigo)}`, { cantidad }),
  /** Solo administrador. */
  enviarCompra: (id: string) => api.post<OrdenCompra>(`/ordenes-compra/${id}/envio`),
  /** Administrador o recepcion, sobre una orden enviada. */
  recibirCompra: (id: string, codigo: string, cantidad: number) =>
    api.post<OrdenCompra>(`/ordenes-compra/${id}/recepcion`, { codigo, cantidad }),
}

export const personal = {
  disponibles: () => api.get<Mecanico[]>('/mecanicos/disponibles'),
}

export const catalogo = {
  servicios: () => api.get<Servicio[]>('/servicios'),
}
