import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Todo import de `three` pasa por el modulo de compatibilidad, que
      // reemplaza el THREE.Clock obsoleto por uno sobre THREE.Timer.
      // Ver src/three-compat/three.ts.
      { find: /^three$/, replacement: ruta('./src/three-compat/three.ts') },
      { find: /^three-original$/, replacement: ruta('./node_modules/three/build/three.module.js') },
    ],
  },
})
