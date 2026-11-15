# Frontend · Sistema de Gestión del Taller Automotriz Automatizado

Interfaz web del sistema de gestión para un taller de **automóviles y motocicletas**.

El proyecto vive en tres repositorios:

| Repositorio | Contiene |
|---|---|
| **Este** | El frontend en React |
| [BACKEND-TALLER-AUTOMOTRIZ](https://github.com/camilin0811/BACKEND-TALLER-AUTOMOTRIZ) | La API en Java y Spring Boot |
| [TALLER-AUTOMOTRIZ](https://github.com/camilin0811/TALLER-AUTOMOTRIZ) | La wiki de diseño, las 20 historias de usuario y los diagramas |

Los [mockups](https://github.com/camilin0811/TALLER-AUTOMOTRIZ/wiki/06-Mockups) de la wiki son la referencia de estas pantallas, con la justificación de cada decisión de diseño.

## Requisitos

- **Node 20** o superior
- El **backend en ejecución**, por defecto en `http://localhost:8080`

## Ejecutar

```bash
npm install
cp .env.example .env.local     # ajustar solo si el backend no está en el puerto por defecto
npm run dev
```

Queda en `http://localhost:5173`.

```bash
npm run build     # compila TypeScript y empaqueta para producción
npm run preview   # sirve el resultado del build
```

## Desplegar

Vercel y Netlify detectan la configuracion sola; los archivos `vercel.json` y `netlify.toml` ya traen el fallback de rutas, que es lo que más se rompe al desplegar una aplicación de una sola página.

La única variable que hay que definir es la URL de la API:

```
VITE_API_URL = https://tu-backend.up.railway.app/api/v1
```

> **Se incrusta al compilar, no se lee al ejecutar.** Si la cambias después, hay que volver a desplegar.

Y en el backend hay que poner la URL del frontend en `CORS_ORIGENES`, o el navegador bloqueará las llamadas. El paso a paso completo está en la [guía de despliegue](https://github.com/camilin0811/BACKEND-TALLER-AUTOMOTRIZ/blob/main/DESPLIEGUE.md).

Con Docker:

```bash
docker build --build-arg VITE_API_URL=https://tu-backend/api/v1 -t taller-frontend .
docker run -p 8080:80 taller-frontend
```

## Pantallas

| Ruta | Pantalla | Para quién |
|---|---|---|
| `/recepcion` | Tablero de órdenes con indicadores y alertas de reposición | Recepcionista |
| `/ordenes/:id` | Detalle de la orden con línea de tiempo y acciones | Recepcionista |
| `/mecanico` | Maestro-detalle de las órdenes asignadas | Mecánico (tablet) |
| `/inventario` | Stock, movimientos y órdenes de compra | Administrador |
| `/portal` | Consulta pública del estado del vehículo | Cliente |

## Estructura

```
src/
├── api/           cliente HTTP y tipos espejo de los DTO del backend
├── componentes/   piezas compartidas: estado, línea de tiempo, avisos
├── paginas/       una por pantalla
├── formato.ts     moneda, fechas y textos legibles
└── estilos.css    tokens de diseño tomados de los mockups
```

## Tres decisiones que conviene conocer

**Los tipos son espejo del backend.** `src/api/tipos.ts` replica los DTO de la API. Si el backend cambia un contrato, TypeScript lo delata al compilar en vez de dejar que falle en el navegador del recepcionista.

**Los errores se muestran tal como los redacta el backend.** La API devuelve un `codigo` estable y un `mensaje` ya escrito para una persona —por ejemplo el saldo real pendiente, o las transiciones válidas desde el estado actual—. El frontend decide qué hacer según el código y muestra el mensaje sin reescribirlo.

**El color nunca comunica solo.** Toda insignia de estado lleva su texto. Nadie debería depender del verde para saber en qué va su vehículo.

## Lo que falta

- **Autenticación**: el backend aún no la tiene, así que no hay pantalla de inicio de sesión.
- Alta de clientes, vehículos y citas desde la interfaz; hoy se crean por API.
- Pruebas de componentes.
