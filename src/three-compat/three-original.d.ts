/*
 * Para qué sirve: Declara el tipo del alias three-original que usa three-compat/three.ts.
 * Patrones: ninguno de diseño específico; es una pieza sencilla de su capa.
 */
// El alias de vite.config.ts apunta este nombre al build real de three.
declare module 'three-original' {
  export * from 'three'
}
