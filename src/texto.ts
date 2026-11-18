/**
 * Texto comparable: sin tildes ni mayusculas.
 *
 * NFD separa cada letra de su tilde ("í" -> "i" + acento combinable) y el
 * rango U+0300–U+036F son esos acentos sueltos, que se descartan. Asi
 * "Bujía" y "bujia" quedan iguales. La ñ tambien pasa a n, lo que en una
 * busqueda es lo esperable.
 */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * True si alguno de los campos contiene el termino buscado, ignorando
 * tildes y mayusculas. Un termino vacio coincide con todo.
 */
export function coincide(termino: string, ...campos: (string | null | undefined)[]): boolean {
  const buscado = normalizar(termino)
  return !buscado || campos.some((campo) => normalizar(campo).includes(buscado))
}
