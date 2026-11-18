import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorApi } from '../api/cliente'
import { clientes, ordenes, vehiculos } from '../api/servicios'
import type { Cliente, TipoVehiculo, Vehiculo } from '../api/tipos'
import { useAccionConfirmada, useNotificar, mensajeDeError } from '../componentes/interaccion'

/*
 * Recepcion de un vehiculo en tres partes: cliente, vehiculo e ingreso.
 * Las reglas son las mismas que valida el backend; aqui solo evitan el
 * viaje y explican el error junto al campo.
 */

const ANIO_MAXIMO = new Date().getFullYear() + 1
const soloDigitos = (v: string) => v.replace(/\D/g, '')
const limpiarPlaca = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')
const limpiarTelefono = (v: string) => v.replace(/[\s()-]/g, '')

type Errores = Partial<Record<
  'documento' | 'nombre' | 'telefono' | 'email' | 'placa' | 'tipo' | 'marca' | 'linea' | 'anio'
  | 'kilometraje' | 'motivo', string>>

/** null: aun no se busca; 'nuevo': se busco y no existe; objeto: encontrado o creado. */
type Busqueda<T> = null | 'nuevo' | T

export function NuevaOrden() {
  const navegar = useNavigate()
  const notificar = useNotificar()
  const ejecutarConfirmado = useAccionConfirmada()

  const [documento, setDocumento] = useState('')
  const [cliente, setCliente] = useState<Busqueda<Cliente>>(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')

  const [placa, setPlaca] = useState('')
  const [vehiculo, setVehiculo] = useState<Busqueda<Vehiculo>>(null)
  const [tipo, setTipo] = useState<TipoVehiculo | ''>('')
  const [marca, setMarca] = useState('')
  const [linea, setLinea] = useState('')
  const [anio, setAnio] = useState('')

  const [kilometraje, setKilometraje] = useState('')
  const [motivo, setMotivo] = useState('')

  const [errores, setErrores] = useState<Errores>({})
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const clienteListo = cliente !== null
  // Una placa ya registrada pertenece a alguien: si el cliente es nuevo, a
  // otra persona seguro; si existe, solo es suya si coincide el id.
  const vehiculoAjeno = vehiculo !== null && vehiculo !== 'nuevo' && cliente !== null
    && (cliente === 'nuevo' || vehiculo.idCliente !== cliente.id)

  async function buscarCliente() {
    if (!/^\d{5,15}$/.test(documento)) {
      setErrores({ documento: 'Escriba solo los números del documento (entre 5 y 15 dígitos).' })
      return
    }
    setErrores({})
    setBuscando(true)
    try {
      setCliente(await clientes.porDocumento(documento))
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 404) setCliente('nuevo')
      else notificar('error', mensajeDeError(e))
    } finally {
      setBuscando(false)
    }
  }

  async function buscarVehiculo() {
    if (!/^[A-Z0-9]{3,8}$/.test(placa)) {
      setErrores({ placa: 'Escriba la placa con letras y números (entre 3 y 8), sin espacios ni guiones.' })
      return
    }
    setErrores({})
    setBuscando(true)
    try {
      setVehiculo(await vehiculos.porPlaca(placa))
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 404) setVehiculo('nuevo')
      else notificar('error', mensajeDeError(e))
    } finally {
      setBuscando(false)
    }
  }

  function cambiarCliente() {
    setCliente(null)
    setVehiculo(null)
  }

  function validar(): Errores {
    const e: Errores = {}
    if (cliente === 'nuevo') {
      if (nombre.trim().length < 3) e.nombre = 'Escriba el nombre completo (al menos 3 letras).'
      if (!/^\+?\d{7,15}$/.test(limpiarTelefono(telefono))) e.telefono = 'El teléfono debe tener entre 7 y 15 dígitos.'
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'El correo no tiene un formato válido.'
    }
    if (vehiculo === null) e.placa = 'Busque el vehículo por su placa.'
    if (vehiculo === 'nuevo') {
      if (!tipo) e.tipo = 'Indique si es automóvil o motocicleta.'
      if (!marca.trim()) e.marca = 'Escriba la marca.'
      if (!linea.trim()) e.linea = 'Escriba el modelo.'
      const a = Number(anio)
      if (!Number.isInteger(a) || a < 1950 || a > ANIO_MAXIMO) e.anio = `El año debe estar entre 1950 y ${ANIO_MAXIMO}.`
    }
    const km = Number(kilometraje)
    const minimo = vehiculo && vehiculo !== 'nuevo' ? vehiculo.kilometraje : 0
    if (kilometraje === '' || !Number.isInteger(km) || km < 0 || km > 2_000_000) {
      e.kilometraje = 'Escriba el kilometraje en números (entre 0 y 2.000.000).'
    } else if (km < minimo) {
      e.kilometraje = `No puede ser menor al último registrado (${minimo.toLocaleString('es-CO')} km).`
    }
    const m = motivo.trim()
    if (m.length < 5 || m.length > 500) e.motivo = 'Describa el motivo o los síntomas (entre 5 y 500 caracteres).'
    return e
  }

  async function crear(ev: React.FormEvent) {
    ev.preventDefault()
    if (!clienteListo || vehiculoAjeno) return
    const encontrados = validar()
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) {
      notificar('error', 'Revise los campos marcados antes de crear la orden.')
      return
    }

    const nombreCliente = cliente === 'nuevo' ? nombre.trim() : cliente.nombre
    setGuardando(true)
    const orden = await ejecutarConfirmado({
      titulo: 'Crear orden de trabajo',
      mensaje: (
        <>
          <p>Se recibirá el vehículo <strong>{placa}</strong> de <strong>{nombreCliente}</strong> con
            {' '}{Number(kilometraje).toLocaleString('es-CO')} km.</p>
          {(cliente === 'nuevo' || vehiculo === 'nuevo') && (
            <p className="tenue">
              También se registrará {cliente === 'nuevo' ? 'el cliente' : ''}
              {cliente === 'nuevo' && vehiculo === 'nuevo' ? ' y ' : ''}
              {vehiculo === 'nuevo' ? 'el vehículo' : ''}.
            </p>
          )}
        </>
      ),
      confirmar: 'Crear orden',
      exito: 'Orden creada en estado «Recibida».',
    }, async () => {
      // Cada paso guarda lo creado: si uno posterior falla, al reintentar
      // se reutiliza en vez de duplicar el cliente o el vehiculo.
      let elCliente = cliente
      if (elCliente === 'nuevo') {
        elCliente = await clientes.crear({
          nombre: nombre.trim(), documento, telefono: limpiarTelefono(telefono),
          ...(email.trim() ? { email: email.trim() } : {}),
        })
        setCliente(elCliente)
      }
      if (vehiculo === 'nuevo' && elCliente) {
        const creado = await vehiculos.crear({
          tipo: tipo as TipoVehiculo, placa, idCliente: elCliente.id,
          marca: marca.trim(), linea: linea.trim(), anio: Number(anio), kilometraje: Number(kilometraje),
        })
        setVehiculo(creado)
      }
      return ordenes.crear({ placa, kilometraje: Number(kilometraje), motivo: motivo.trim() })
    }, (e) => {
      if (e instanceof ErrorApi) setErrores((previos) => ({ ...previos, ...e.erroresDeCampo }))
    })
    setGuardando(false)
    if (orden) navegar(`/ordenes/${orden.id}`)
  }

  const err = (campo: keyof Errores) => errores[campo] && (
    <div className="error-campo" id={`${campo}-error`}>{errores[campo]}</div>
  )
  const describe = (campo: keyof Errores) => ({
    'aria-invalid': Boolean(errores[campo]),
    'aria-describedby': errores[campo] ? `${campo}-error` : undefined,
  })

  return (
    <form onSubmit={crear} noValidate className="nueva-orden">
      <div className="encabezado">
        <h2>Nueva orden</h2>
        <Link to="/recepcion" className="boton-enlace secundario">Cancelar</Link>
      </div>

      {/* ------------------------------------------------------- cliente */}
      <section className="panel" aria-labelledby="titulo-cliente">
        <h3 id="titulo-cliente">1 · Cliente</h3>
        <div className="fila fila-busqueda">
          <div className="campo">
            <label htmlFor="documento">Documento del cliente</label>
            <input id="documento" value={documento} inputMode="numeric" maxLength={15} autoComplete="off"
                   placeholder="Número de documento" disabled={clienteListo} {...describe('documento')}
                   onChange={(e) => setDocumento(soloDigitos(e.target.value))} />
            {err('documento')}
          </div>
          {clienteListo ? (
            <button type="button" className="secundario" onClick={cambiarCliente}>Cambiar</button>
          ) : (
            <button type="button" className="primario" onClick={buscarCliente} disabled={buscando}>
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          )}
        </div>

        {cliente && cliente !== 'nuevo' && (
          <p className="resultado-busqueda">
            ✓ <strong>{cliente.nombre}</strong>{cliente.telefono && <> · {cliente.telefono}</>}
            {cliente.email && <> · {cliente.email}</>}
          </p>
        )}
        {cliente === 'nuevo' && (
          <>
            <p className="tenue">No hay un cliente con ese documento. Complete sus datos para registrarlo.</p>
            <div className="fila">
              <div className="campo">
                <label htmlFor="nombre">Nombre completo</label>
                <input id="nombre" value={nombre} maxLength={120} autoComplete="off" {...describe('nombre')}
                       onChange={(e) => setNombre(e.target.value)} />
                {err('nombre')}
              </div>
              <div className="campo">
                <label htmlFor="telefono">Teléfono</label>
                <input id="telefono" value={telefono} inputMode="tel" maxLength={20} autoComplete="off"
                       placeholder="Ej.: 3001234567" {...describe('telefono')}
                       onChange={(e) => setTelefono(e.target.value)} />
                {err('telefono')}
              </div>
              <div className="campo">
                <label htmlFor="email">Correo (opcional)</label>
                <input id="email" type="email" value={email} maxLength={120} autoComplete="off" {...describe('email')}
                       onChange={(e) => setEmail(e.target.value)} />
                {err('email')}
              </div>
            </div>
          </>
        )}
      </section>

      {/* ------------------------------------------------------ vehiculo */}
      <section className="panel" aria-labelledby="titulo-vehiculo" aria-disabled={!clienteListo}>
        <h3 id="titulo-vehiculo">2 · Vehículo</h3>
        {!clienteListo ? (
          <p className="tenue">Primero busque o registre el cliente.</p>
        ) : (
          <>
            <div className="fila fila-busqueda">
              <div className="campo">
                <label htmlFor="placa">Placa</label>
                <input id="placa" value={placa} maxLength={8} autoComplete="off" autoCapitalize="characters"
                       placeholder="Ej.: XYZ987" disabled={vehiculo !== null} {...describe('placa')}
                       onChange={(e) => setPlaca(limpiarPlaca(e.target.value))} />
                {err('placa')}
              </div>
              {vehiculo !== null ? (
                <button type="button" className="secundario" onClick={() => setVehiculo(null)}>Cambiar</button>
              ) : (
                <button type="button" className="primario" onClick={buscarVehiculo} disabled={buscando}>
                  {buscando ? 'Buscando…' : 'Buscar'}
                </button>
              )}
            </div>

            {vehiculoAjeno && (
              <div className="aviso error" role="alert">
                <span className="icono">!</span>
                <div className="texto">
                  La placa <strong>{placa}</strong> está registrada a nombre de otro cliente. Verifique la placa
                  o el documento; el cambio de propietario se hace aparte.
                </div>
              </div>
            )}
            {vehiculo && vehiculo !== 'nuevo' && !vehiculoAjeno && (
              <p className="resultado-busqueda">
                ✓ <strong>{vehiculo.marca} {vehiculo.linea}</strong> · {vehiculo.anio} ·
                {' '}{vehiculo.tipo === 'MOTOCICLETA' ? 'Motocicleta' : 'Automóvil'} ·
                {' '}último kilometraje {vehiculo.kilometraje.toLocaleString('es-CO')} km
              </p>
            )}
            {vehiculo === 'nuevo' && (
              <>
                <p className="tenue">No hay un vehículo con esa placa. Complete sus datos para registrarlo.</p>
                <fieldset className="campo selector-tipo" aria-describedby={errores.tipo ? 'tipo-error' : undefined}>
                  <legend>Tipo de vehículo</legend>
                  <label><input type="radio" name="tipo" value="AUTOMOVIL" checked={tipo === 'AUTOMOVIL'}
                                onChange={() => setTipo('AUTOMOVIL')} /> Automóvil</label>
                  <label><input type="radio" name="tipo" value="MOTOCICLETA" checked={tipo === 'MOTOCICLETA'}
                                onChange={() => setTipo('MOTOCICLETA')} /> Motocicleta</label>
                  {err('tipo')}
                </fieldset>
                <div className="fila">
                  <div className="campo">
                    <label htmlFor="marca">Marca</label>
                    <input id="marca" value={marca} maxLength={40} autoComplete="off" {...describe('marca')}
                           onChange={(e) => setMarca(e.target.value)} />
                    {err('marca')}
                  </div>
                  <div className="campo">
                    <label htmlFor="linea">Modelo</label>
                    <input id="linea" value={linea} maxLength={60} autoComplete="off" {...describe('linea')}
                           onChange={(e) => setLinea(e.target.value)} />
                    {err('linea')}
                  </div>
                  <div className="campo">
                    <label htmlFor="anio">Año</label>
                    <input id="anio" value={anio} inputMode="numeric" maxLength={4} autoComplete="off"
                           {...describe('anio')} onChange={(e) => setAnio(soloDigitos(e.target.value))} />
                    {err('anio')}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------- ingreso */}
      <section className="panel" aria-labelledby="titulo-ingreso">
        <h3 id="titulo-ingreso">3 · Ingreso</h3>
        <div className="fila">
          <div className="campo" style={{ maxWidth: 260 }}>
            <label htmlFor="kilometraje">Kilometraje de ingreso</label>
            <input id="kilometraje" value={kilometraje} inputMode="numeric" maxLength={7} autoComplete="off"
                   {...describe('kilometraje')} onChange={(e) => setKilometraje(soloDigitos(e.target.value))} />
            {err('kilometraje')}
          </div>
        </div>
        <div className="campo">
          <label htmlFor="motivo">Motivo o síntomas que reporta el cliente</label>
          <textarea id="motivo" value={motivo} rows={3} maxLength={500} {...describe('motivo')}
                    placeholder="Ej.: ruido metálico al frenar en bajadas"
                    onChange={(e) => setMotivo(e.target.value)} />
          <div className="contador">{motivo.trim().length}/500</div>
          {err('motivo')}
        </div>
      </section>

      <div className="acciones">
        <button type="submit" className="primario" disabled={guardando || !clienteListo || vehiculoAjeno}>
          {guardando ? 'Creando…' : 'Crear orden'}
        </button>
        <Link to="/recepcion" className="boton-enlace secundario">Cancelar</Link>
      </div>
    </form>
  )
}
