/** Formatos locales en un solo lugar, para que no se repitan dispersos. */

const PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export const dinero = (valor: number | null | undefined) =>
  PESOS.format(valor ?? 0)

export const fecha = (iso: string | null | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export const fechaHora = (iso: string | null | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/** Solo la fecha: "14 nov 2026". */
export const soloFecha = (iso: string | null | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

/** Solo la hora: "8:51 p. m.". */
export const soloHora = (iso: string | null | undefined) => {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}
