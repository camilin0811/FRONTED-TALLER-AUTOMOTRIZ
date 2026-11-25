# Patrones de diseño — Frontend

Índice de dónde se aplica cada patrón. Cada clase tiene además, en su encabezado, **para qué sirve** y sus patrones, y en el código hay comentarios `// PATRÓN ...` en las líneas exactas donde se aplica. En VS Code: **Ctrl+Shift+F** y buscar `PATRÓN`.

## Adapter

- [`three.ts`](src/three-compat/three.ts) — Clock ofrece la interfaz que espera React Three Fiber, implementada sobre THREE.Timer.

## Observer (publicar/suscribir)

- [`cliente.ts`](src/api/cliente.ts) — ante un 401 emite el evento 'sesion-expirada', que escucha el contexto de autenticación.
- [`Contexto.tsx`](src/autenticacion/Contexto.tsx) — escucha el evento 'sesion-expirada' que emite el cliente de la API y cierra la sesión.
- [`Coche3D.tsx`](src/componentes/Coche3D.tsx) — OrbitControls avisa con onStart/onEnd cuando el usuario arrastra, para pausar el giro automático.
- [`CocheEscaparate.tsx`](src/componentes/CocheEscaparate.tsx) — IntersectionObserver y el evento visibilitychange avisan cuándo la vitrina se ve, para pausar el render cuando no.

## DTO (Data Transfer Object)

- [`tipos.ts`](src/api/tipos.ts) — contratos tipados de la API: si el backend cambia uno, el compilador lo detecta.

## Provider (React Context)

- [`App.tsx`](src/App.tsx) — envuelve todas las rutas con ProveedorAutenticacion y ProveedorInteraccion para que cualquier página use la sesión, los modales y los avisos.
- [`Contexto.tsx`](src/autenticacion/Contexto.tsx) — ProveedorAutenticacion publica la sesión en un Context de React.
- [`ProveedorInteraccion.tsx`](src/componentes/ProveedorInteraccion.tsx) — publica en un Context las funciones confirmar y notificar.

## Custom Hook (React)

- [`Contexto.tsx`](src/autenticacion/Contexto.tsx) — useAutenticacion() da acceso a ese contexto desde cualquier componente.
- [`interaccion.ts`](src/componentes/interaccion.ts) — cada hook da acceso a una parte del contexto de interacción.

## Facade

- [`cliente.ts`](src/api/cliente.ts) — api.get/post/put/patch esconden fetch, cabeceras, JSON, tiempos de espera y manejo de errores detrás de una interfaz simple.
- [`servicios.ts`](src/api/servicios.ts) — las páginas llaman, por ejemplo, ordenes.obtener(id) sin conocer URLs ni métodos HTTP.
- [`sesion.ts`](src/autenticacion/sesion.ts) — el objeto almacen esconde localStorage y el formato JSON de la sesión.

## Ruta protegida (Guard)

- [`App.tsx`](src/App.tsx) — cada ruta interna va dentro de <Guarda roles={...}>.
- [`Guarda.tsx`](src/autenticacion/Guarda.tsx) — componente envoltorio que decide si muestra la página. Es comodidad de interfaz: la seguridad real la aplica el backend.

## Proxy virtual (carga diferida)

- [`CocheEscaparate.tsx`](src/componentes/CocheEscaparate.tsx) — React.lazy carga Coche3D solo cuando la vitrina entra en pantalla; mientras tanto se ve un fondo estático en su lugar.

## Command

- [`interaccion.ts`](src/componentes/interaccion.ts) — useAccionConfirmada recibe la acción como una función junto con sus mensajes, y la ejecuta solo si el usuario confirma.

## Game Loop / Update Method

- [`Coche3D.tsx`](src/componentes/Coche3D.tsx) — cada pieza de la escena se actualiza en useFrame, una vez por cuadro; los cambios de modo y las luces avanzan con el tiempo transcurrido.

## Clases sin un patrón de diseño específico

Piezas sencillas (enums, utilidades, páginas, pruebas unitarias): tienen igual su comentario de para qué sirven.

- [`inicio.ts`](src/autenticacion/inicio.ts)
- [`Aviso.tsx`](src/componentes/Aviso.tsx)
- [`Cargando.tsx`](src/componentes/Cargando.tsx)
- [`Estado.tsx`](src/componentes/Estado.tsx)
- [`LineaTiempo.tsx`](src/componentes/LineaTiempo.tsx)
- [`Modal.tsx`](src/componentes/Modal.tsx)
- [`estados.ts`](src/estados.ts)
- [`formato.ts`](src/formato.ts)
- [`main.tsx`](src/main.tsx)
- [`DetalleOrden.tsx`](src/paginas/DetalleOrden.tsx)
- [`Inventario.tsx`](src/paginas/Inventario.tsx)
- [`Login.tsx`](src/paginas/Login.tsx)
- [`NoEncontrada.tsx`](src/paginas/NoEncontrada.tsx)
- [`NuevaOrden.tsx`](src/paginas/NuevaOrden.tsx)
- [`PanelRecepcion.tsx`](src/paginas/PanelRecepcion.tsx)
- [`PortalCliente.tsx`](src/paginas/PortalCliente.tsx)
- [`VistaMecanico.tsx`](src/paginas/VistaMecanico.tsx)
- [`servicios.ts`](src/servicios.ts)
- [`texto.ts`](src/texto.ts)
- [`three-original.d.ts`](src/three-compat/three-original.d.ts)
