/*
 * Para qué sirve: Provee a toda la app el modal de confirmación y los avisos emergentes (toasts).
 * PATRÓN Provider (React Context): publica en un Context las funciones confirmar y notificar.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { Modal } from './Modal'
import { Contexto, type OpcionesConfirmacion, type TonoToast } from './interaccion'

interface Toast {
  id: number
  tono: TonoToast
  mensaje: string
}

/** Un toast de exito se va solo; uno de error espera a que lo cierren. */
const DURACION_EXITO_MS = 4500

/**
 * Provee las dos piezas de interaccion de la app: el modal de
 * confirmacion y los toasts. Se monta una sola vez, arriba del arbol.
 */
export function ProveedorInteraccion({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pendiente, setPendiente] = useState<OpcionesConfirmacion | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const siguienteId = useRef(1)

  const cerrarToast = useCallback((id: number) => {
    setToasts((lista) => lista.filter((t) => t.id !== id))
  }, [])

  const notificar = useCallback((tono: TonoToast, mensaje: string) => {
    const id = siguienteId.current++
    // Un exito descarta los errores anteriores: ya no describen el estado
    // actual y dejarlos en pantalla confunde.
    setToasts((lista) => [...(tono === 'exito' ? lista.filter((t) => t.tono === 'exito') : lista).slice(-3),
      { id, tono, mensaje }])
    if (tono === 'exito') window.setTimeout(() => cerrarToast(id), DURACION_EXITO_MS)
  }, [cerrarToast])

  const confirmar = useCallback((opciones: OpcionesConfirmacion) => new Promise<boolean>((resolve) => {
    // Si se llega a confirmar, los errores de validacion previos ya no
    // aplican: el formulario paso a ser valido. No deben quedar a la vista
    // mientras el modal esta abierto.
    setToasts((lista) => lista.filter((t) => t.tono === 'exito'))
    resolver.current = resolve
    setPendiente(opciones)
  }), [])

  const responder = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setPendiente(null)
  }, [])

  const valor = useMemo(() => ({ notificar, confirmar }), [notificar, confirmar])
  const cancelar = useCallback(() => responder(false), [responder])

  return (
    <Contexto.Provider value={valor}>
      {children}

      <Modal
        abierto={pendiente !== null}
        titulo={pendiente?.titulo ?? ''}
        alCerrar={cancelar}
        pie={pendiente && (
          <>
            <button className="secundario" onClick={cancelar}>Cancelar</button>
            <button className={pendiente.peligro ? 'peligro-lleno' : 'primario'} onClick={() => responder(true)}>
              {pendiente.confirmar}
            </button>
          </>
        )}
      >
        {pendiente?.mensaje}
      </Modal>

      {/* aria-live: el lector de pantalla anuncia el resultado sin mover el foco. */}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tono}`} role={t.tono === 'error' ? 'alert' : 'status'}>
            <span className="toast-icono" aria-hidden>{t.tono === 'exito' ? '✓' : '!'}</span>
            <span className="toast-texto">{t.mensaje}</span>
            <button className="toast-cerrar" onClick={() => cerrarToast(t.id)} aria-label="Cerrar notificación">×</button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  )
}
