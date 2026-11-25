/**
 * Servicios del taller: una sola fuente para la seccion "Servicios" de la
 * pagina de acceso y para las tarjetas de los puntos del auto 3D.
 */
export interface Servicio {
  id: 'diagnostico' | 'mantenimiento' | 'competicion' | 'motocicletas'
  titulo: string
  texto: string
}

export const SERVICIOS: Servicio[] = [
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico computarizado',
    texto: 'Escáner OBD-II conectado a la orden: los códigos de falla se registran solos, sin transcripciones.',
  },
  {
    id: 'mantenimiento',
    titulo: 'Mantenimiento preventivo',
    texto: 'Planes por kilometraje con recordatorio automático: el taller avisa antes de que la falla aparezca.',
  },
  {
    id: 'competicion',
    titulo: 'Preparación de competición',
    texto: 'Puesta a punto de motor, frenos y suspensión con estándares de pista y control de cada ajuste.',
  },
  {
    id: 'motocicletas',
    titulo: 'Motocicletas',
    texto: 'Área dedicada con técnicos de dos ruedas: motor, transmisión final y electrónica de la moto.',
  },
]

export const servicio = (id: Servicio['id']): Servicio =>
  SERVICIOS.find((s) => s.id === id) as Servicio

export type IdZona = 'motor' | 'frenos' | 'suspension' | 'obd'

/** Zona del auto con su punto interactivo y la tarjeta que abre. */
export interface Zona {
  id: IdZona
  nombre: string
  servicio: Servicio['id']
  /** Dato destacado de la tarjeta. */
  dato: string
}

export const ZONAS: Zona[] = [
  { id: 'motor', nombre: 'Motor', servicio: 'mantenimiento', dato: 'Aceite y filtros · cada 5.000 km' },
  { id: 'frenos', nombre: 'Frenos', servicio: 'competicion', dato: 'Discos y pastillas · prueba en pista' },
  { id: 'suspension', nombre: 'Suspensión', servicio: 'competicion', dato: 'Alineación y balanceo · 4 ruedas' },
  { id: 'obd', nombre: 'Electrónica / OBD-II', servicio: 'diagnostico', dato: 'Escaneo OBD-II · 98% OK' },
]
