/*
 * Para qué sirve: Punto de entrada: despierta el backend y monta React con el enrutador.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { despertarServidor } from './api/cliente'
import '@fontsource/rajdhani/600.css'
import '@fontsource/rajdhani/700.css'
import '@fontsource/orbitron/600.css'
import '@fontsource/orbitron/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './estilos.css'

// Antes de dibujar nada: cada segundo cuenta para que el backend despierte.
despertarServidor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
