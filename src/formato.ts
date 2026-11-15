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

/** "EN_ESPERA_REPUESTO" -> "En espera repuesto" */
export const legible = (estado: string) => {
  const t = estado.replace(/_/g, ' ').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
