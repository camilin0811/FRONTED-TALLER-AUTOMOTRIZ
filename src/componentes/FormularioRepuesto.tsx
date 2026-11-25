/*
 * Para qué sirve: Formulario en ventana modal para dar de alta un repuesto en el almacén.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import { useCallback, useState } from 'react'
import { ErrorApi } from '../api/cliente'
import { inventario } from '../api/servicios'
import type { Repuesto } from '../api/tipos'
import { Aviso } from './Aviso'
import { Modal } from './Modal'
import { mensajeDeError } from './interaccion'

interface Campos {
  codigo: string
  nombre: string
  precio: string
  stock: string
  stockMinimo: string
}
type Errores = Partial<Record<keyof Campos | 'general', string>>

const VACIO: Campos = { codigo: '', nombre: '', precio: '', stock: '0', stockMinimo: '0' }
const MAX_UNIDADES = 100_000

/** Acepta "185000", "185.000" o "185000,50": los puntos de miles se quitan y la coma pasa a punto. */
function aNumero(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '')
  const normal = /,\d{1,2}$/.test(limpio) ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/[.,](?=\d{3}\b)/g, '')
  return limpio === '' ? NaN : Number(normal)
}

/** Las mismas reglas que valida el servidor (CrearRepuestoDTO); aqui solo ahorran el viaje. */
function validar(c: Campos): Errores {
  const e: Errores = {}
  if (!c.codigo.trim()) e.codigo = 'Escriba el código del repuesto.'
  else if (!/^[A-Z0-9-]{3,20}$/.test(c.codigo.trim())) e.codigo = 'Use solo letras, números y guiones (entre 3 y 20), por ejemplo PAST-002.'
  const nombre = c.nombre.trim()
  if (!nombre) e.nombre = 'Escriba el nombre del repuesto.'
  else if (nombre.length < 3 || nombre.length > 120) e.nombre = 'El nombre debe tener entre 3 y 120 caracteres.'
  const precio = aNumero(c.precio)
  if (c.precio.trim() === '') e.precio = 'Escriba el precio de venta.'
  else if (!Number.isFinite(precio) || precio <= 0) e.precio = 'El precio debe ser un número mayor que cero.'
  else if (precio > 100_000_000) e.precio = 'El precio no puede pasar de $100.000.000.'
  for (const [campo, etiqueta] of [['stock', 'El stock inicial'], ['stockMinimo', 'El stock mínimo']] as const) {
    const v = c[campo].trim()
    if (!/^\d+$/.test(v)) e[campo] = `${etiqueta} debe ser un número entero de 0 en adelante.`
    else if (Number(v) > MAX_UNIDADES) e[campo] = `${etiqueta} no puede pasar de 100.000 unidades.`
  }
  return e
}

export function FormularioRepuesto({ abierto, alCerrar, alCrear }: {
  abierto: boolean
  alCerrar: () => void
  alCrear: (repuesto: Repuesto) => void
}) {
  const [campos, setCampos] = useState<Campos>(VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)

  const cerrar = useCallback(() => {
    if (guardando) return
    setCampos(VACIO)
    setErrores({})
    alCerrar()
  }, [guardando, alCerrar])

  function cambiar(campo: keyof Campos, valor: string) {
    setCampos((c) => ({ ...c, [campo]: valor }))
    // El error de un campo se borra al corregirlo, no al volver a enviar.
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault()
    const encontrados = validar(campos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return
    setGuardando(true)
    try {
      const creado = await inventario.crearRepuesto({
        codigo: campos.codigo.trim(),
        nombre: campos.nombre.trim(),
        precio: aNumero(campos.precio),
        stock: Number(campos.stock),
        stockMinimo: Number(campos.stockMinimo),
      })
      setCampos(VACIO)
      setErrores({})
      alCrear(creado)
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'RECURSO_DUPLICADO') {
        setErrores({ codigo: `${e.message}. Use otro código o busque el repuesto en la tabla.` })
      } else if (e instanceof ErrorApi && e.codigo === 'VALIDACION') {
        setErrores(e.erroresDeCampo)
      } else if (e instanceof ErrorApi && e.status === 403) {
        setErrores({ general: 'Su usuario no tiene permiso para crear repuestos. Solo el administrador puede hacerlo.' })
      } else {
        setErrores({ general: mensajeDeError(e) })
      }
    } finally {
      setGuardando(false)
    }
  }

  const err = (campo: keyof Campos) => errores[campo] && (
    <div className="error-campo" id={`repuesto-${campo}-error`} role="alert">{errores[campo]}</div>
  )
  const describe = (campo: keyof Campos) => ({
    'aria-invalid': Boolean(errores[campo]),
    'aria-describedby': errores[campo] ? `repuesto-${campo}-error` : undefined,
  })

  return (
    <Modal
      abierto={abierto}
      titulo="Nuevo repuesto"
      alCerrar={cerrar}
      pie={<>
        <button type="button" className="secundario" onClick={cerrar} disabled={guardando}>Cancelar</button>
        <button type="submit" form="formulario-repuesto" className="primario" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar repuesto'}
        </button>
      </>}
    >
      <form id="formulario-repuesto" onSubmit={guardar} noValidate className="formulario-repuesto">
        {errores.general && <Aviso tono="error">{errores.general}</Aviso>}

        <div className="campo">
          <label htmlFor="repuesto-codigo">Código</label>
          <input id="repuesto-codigo" value={campos.codigo} maxLength={20} autoComplete="off"
                 placeholder="PAST-002" {...describe('codigo')}
                 onChange={(e) => cambiar('codigo', e.target.value.toUpperCase().replace(/\s/g, ''))} />
          {err('codigo')}
        </div>

        <div className="campo">
          <label htmlFor="repuesto-nombre">Nombre</label>
          <input id="repuesto-nombre" value={campos.nombre} maxLength={120} autoComplete="off"
                 placeholder="Pastillas de freno traseras" {...describe('nombre')}
                 onChange={(e) => cambiar('nombre', e.target.value)} />
          {err('nombre')}
        </div>

        <div className="campo">
          <label htmlFor="repuesto-precio">Precio de venta (COP)</label>
          <input id="repuesto-precio" value={campos.precio} inputMode="decimal" autoComplete="off"
                 placeholder="85.000" {...describe('precio')}
                 onChange={(e) => cambiar('precio', e.target.value)} />
          {err('precio')}
        </div>

        <div className="rejilla-dos">
          <div className="campo">
            <label htmlFor="repuesto-stock">Stock inicial</label>
            <input id="repuesto-stock" value={campos.stock} inputMode="numeric" autoComplete="off"
                   {...describe('stock')} onChange={(e) => cambiar('stock', e.target.value)} />
            {err('stock')}
          </div>
          <div className="campo">
            <label htmlFor="repuesto-minimo">Stock mínimo</label>
            <input id="repuesto-minimo" value={campos.stockMinimo} inputMode="numeric" autoComplete="off"
                   {...describe('stockMinimo')} onChange={(e) => cambiar('stockMinimo', e.target.value)} />
            {err('stockMinimo')}
          </div>
        </div>
        <p className="tenue ayuda-formulario">
          Cuando un consumo deje el stock en el mínimo o por debajo, el sistema genera sola la orden de compra de reposición.
        </p>
      </form>
    </Modal>
  )
}
