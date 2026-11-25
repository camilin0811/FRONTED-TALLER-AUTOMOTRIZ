/*
 * Para qué sirve: Reexporta three.js con un Clock propio construido sobre THREE.Timer, para evitar
 * el aviso de obsoleto.
 * PATRÓN Adapter: Clock ofrece la interfaz que espera React Three Fiber, implementada sobre
 *     THREE.Timer.
 */
/**
 * three.js con `Clock` implementado sobre `THREE.Timer`.
 *
 * three r168+ declara obsoleto `THREE.Clock` y avisa en consola al
 * construirlo. Nuestro codigo no lo usa, pero @react-three/fiber 9 crea uno
 * en su store y no permite inyectar otro. vite.config.ts redirige el import
 * `three` de todo el proyecto (incluidas las dependencias) a este modulo,
 * que reexporta three intacto salvo `Clock`: asi hay una sola instancia de
 * three y nadie construye el reloj obsoleto.
 *
 * Cuando fiber deje de usar Clock, este archivo y el alias se borran.
 */
import { Timer } from 'three-original'

export * from 'three-original'

/** Misma interfaz publica que THREE.Clock, medida con THREE.Timer. */
// PATRÓN Adapter: misma interfaz que THREE.Clock, implementada sobre THREE.Timer.
export class Clock {
  autoStart: boolean
  startTime = 0
  oldTime = 0
  elapsedTime = 0
  running = false

  private readonly timer = new Timer()

  constructor(autoStart = true) {
    this.autoStart = autoStart
  }

  start(): void {
    this.timer.reset()
    this.startTime = performance.now()
    this.oldTime = this.startTime
    this.elapsedTime = 0
    this.running = true
  }

  stop(): void {
    this.getElapsedTime()
    this.running = false
    this.autoStart = false
  }

  getElapsedTime(): number {
    this.getDelta()
    return this.elapsedTime
  }

  getDelta(): number {
    if (this.autoStart && !this.running) {
      this.start()
      return 0
    }
    if (!this.running) return 0

    this.timer.update()
    const delta = this.timer.getDelta()
    this.oldTime = performance.now()
    this.elapsedTime += delta
    return delta
  }
}
