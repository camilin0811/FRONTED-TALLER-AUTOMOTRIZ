import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Ventana modal propia (no el alert/confirm del navegador).
 *
 * Accesible: role="dialog" con aria-modal, titulo enlazado, Esc cierra, el
 * foco entra al abrir, queda atrapado dentro con Tab y vuelve al elemento
 * que la abrio al cerrar.
 */
export function Modal({ abierto, titulo, alCerrar, children, pie }: {
  abierto: boolean
  titulo: string
  alCerrar: () => void
  children: React.ReactNode
  pie?: React.ReactNode
}) {
  const idTitulo = useId()
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    const enfocables = () => Array.from(caja.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    // El primer control es "Cancelar": confirmar por accidente con Enter
    // no debe ser lo mas facil.
    enfocables()[0]?.focus()

    function teclado(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        alCerrar()
        return
      }
      if (ev.key !== 'Tab') return
      const lista = enfocables()
      if (lista.length === 0) return
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      if (ev.shiftKey && document.activeElement === primero) {
        ev.preventDefault()
        ultimo.focus()
      } else if (!ev.shiftKey && document.activeElement === ultimo) {
        ev.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', teclado)
    document.body.classList.add('con-modal')
    return () => {
      document.removeEventListener('keydown', teclado)
      document.body.classList.remove('con-modal')
      previo?.focus()
    }
  }, [abierto, alCerrar])

  if (!abierto) return null

  return createPortal(
    <div className="modal-fondo" onMouseDown={(ev) => ev.target === ev.currentTarget && alCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={caja}>
        <h2 id={idTitulo} className="modal-titulo">{titulo}</h2>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}
