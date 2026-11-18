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
export type Rol = 'CLIENTE' | 'MECANICO' | 'RECEPCIONISTA' | 'ADMINISTRADOR'

export interface Token {
  token: string
  tipo: string
  expiraEnSegundos: number
  usuario: string
  rol: Rol
  nombre: string
}
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
  /** Ausentes en el portal publico: no expone al personal del taller. */
  usuario?: string | null
  nombre?: string | null
  rol?: Rol | null
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
  idMecanico?: string | null
  motivoIngreso?: string | null
}

/** Usuario con rol mecanico que se puede asignar a una orden. */
export interface MecanicoAsignable {
  idMecanico: string
  nombre: string
  usuario: string
  especialidad: string | null
  disponible: boolean
}

export interface Cliente {
  id: string
  nombre: string
  documento: string
  telefono: string | null
  email: string | null
}

export interface Vehiculo {
  id: string
  placa: string
  marca: string | null
  linea: string | null
  anio: number
  kilometraje: number
  idCliente: string
  tipo: TipoVehiculo
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

export type EstadoCompra = 'BORRADOR' | 'ENVIADA' | 'RECIBIDA_PARCIAL' | 'RECIBIDA' | 'ANULADA'

export interface OrdenCompra {
  id: string
  numero: string | null
  idProveedor: string | null
  fecha: string
  estado: EstadoCompra
  /** null: la genero la reposicion automatica. */
  generadaPor?: string | null
  items: ItemCompra[]
}

/** Respuesta del portal: la orden en curso y el historial del vehiculo. */
export interface ConsultaPublica {
  orden: OrdenDetalle
  historial: {
    numero: string | null
    estado: EstadoOrden
    fechaIngreso: string
    fechaEntrega: string | null
    total: number | null
  }[]
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
