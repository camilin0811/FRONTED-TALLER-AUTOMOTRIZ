/**
 * Espejo de los DTO del backend.
 *
 * Si el backend cambia un contrato, TypeScript lo delata al compilar en vez
 * de dejar que falle en el navegador del recepcionista.
 */

export type EstadoOrden =
  | 'RECIBIDA'
  | 'EN_DIAGNOSTICO'
  | 'COTIZADA'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'EN_REPARACION'
  | 'EN_ESPERA_REPUESTO'
  | 'CERRADA'
  | 'FACTURADA'
  | 'ENTREGADA'

export type TipoVehiculo = 'AUTOMOVIL' | 'MOTOCICLETA'
export type CanalAprobacion = 'WHATSAPP' | 'PORTAL_WEB' | 'PRESENCIAL'

export interface OrdenResumen {
  id: string
  numero: string | null
  estado: EstadoOrden
  placa: string | null
  tipoVehiculo: TipoVehiculo | null
  descripcionVehiculo: string | null
  cliente: string | null
  mecanico: string | null
  total: number
  fechaIngreso: string
}

export interface Item {
  codigo: string
  descripcion: string
  cantidad: number
  valor: number
}

export interface Hito {
  estado: EstadoOrden
  fecha: string
  usuario: string | null
}

export interface OrdenDetalle {
  id: string
  numero: string | null
  estado: EstadoOrden
  fechaIngreso: string
  fechaEntrega: string | null
  kilometrajeIngreso: number
  placa: string | null
  descripcionVehiculo: string | null
  cliente: string | null
  mecanico: string | null
  codigosFalla: string[]
  numeroCotizacion: string | null
  estadoCotizacion: string | null
  servicios: Item[]
  repuestos: Item[]
  historial: Hito[]
  total: number
  idFactura: string | null
}

export interface Repuesto {
  id: string
  codigo: string
  nombre: string
  precio: number
  stock: number
  stockMinimo: number
  idsProveedores: string[]
}

export interface Movimiento {
  id: string
  codigoRepuesto: string
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE'
  cantidad: number
  motivo: string
  idOrden: string | null
  stockResultante: number
  fecha: string
}

export interface Mecanico {
  id: string
  nombre: string
  documento: string
  codigo: string
  especialidad: string | null
  disponible: boolean
}

export interface ItemCompra {
  codigoRepuesto: string
  cantidad: number
  cantidadRecibida: number
  precioUnitario: number
}

export interface OrdenCompra {
  id: string
  numero: string | null
  idProveedor: string | null
  fecha: string
  estado: 'BORRADOR' | 'ENVIADA' | 'RECIBIDA_PARCIAL' | 'RECIBIDA' | 'ANULADA'
  items: ItemCompra[]
}

export interface Servicio {
  id: string
  codigo: string
  descripcion: string
  precio: number
  horasEstimadas: number
  activo: boolean
}

/** Forma uniforme de los errores de la API. */
export interface CuerpoError {
  timestamp: string
  status: number
  error: string
  codigo: string
  mensaje: string
  ruta: string
  correlacionId: string
  detalle?: Record<string, unknown>
}
