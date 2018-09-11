import {upKey} from './src/keys.js'
import levels from './src/levels.js'
import sleep from './src/sleep.js'
import Body from './src/body.js'
import Goal from './src/goal.js'
import Guy from './src/guy.js'
import Bar from './src/bar.js'
import Title from './src/title.js'
import {GOAL_FX, JUMP_FX, DEATH_FX, ON_FX, OFF_FX} from './src/sound.js'
import create from './src/create.js'
import {WIDTH, HEIGHT} from './src/dimensions.js'

class Scene extends Body {
  constructor (levels) {
    super(document.getElementById('game'))
    this.bars = []
    this.deaths = 0
    this.paused = false
    this.guy = new Guy
    this.append(this.guy)
    this.goal = new Goal
    this.append(this.goal)
    this.index = 0
  }

  get on () {
    return this._on
  }

  set on (value) {
    this._on = value
    document.body.classList.toggle('on', value)
    document.body.classList.toggle('off', !value)
  }

  get index () {
    return this._index
  }

  set index (value) {
    this._index = Math.min(levels.length - 1, Math.max(value || 0))

    const [guy, goal, bars] = this.level
    this.on = true
    this.guy.load(...guy)
    this.goal.load(...goal)

    while (this.bars.length) this.bars.pop().remove()
    for (const values of bars) {
      const bar = new Bar(...values)
      this.append(bar)
      this.bars.push(bar)
    }
  }

  get level () {
    return levels[this.index]
  }

  get deaths () {
    return this._deaths
  }

  set deaths (value) {
    this._deaths = value
    const counter = document.getElementById('death_counter')
    counter.innerHTML = ''
    let s = value.toString()
    for (let i = 0; i < s.length; i++) {
      const rect = create('rect')
      rect.setAttribute('fill', `url(#n${s[i]})`)
      rect.setAttribute('width', 10)
      rect.setAttribute('height', 16)
      rect.setAttribute('x', 12 * i)
      counter.appendChild(rect)
    }
  }

  async advance () {
    GOAL_FX.play()
    this.paused = true
    document.body.classList.add('finish')
    await sleep(1000)
    this.index += 1
    document.body.classList.remove('finish')
    await sleep(1000)
    this.paused = false
  }

  async death () {
    DEATH_FX.play()
    this.deaths += 1
    this.paused = true
    const death = document.getElementById('death')
    death.setAttribute('x', this.guy.x - 32 + this.guy.width / 2)
    death.setAttribute('y', this.guy.y - 32 + this.guy.height / 2)
    this.guy.element.setAttribute('hidden', true)
    document.body.classList.add('dying')
    await sleep(700)
    document.body.classList.remove('dying')
    this.reset()
    this.guy.element.removeAttribute('hidden')
    this.paused = false
  }

  reset () {
    this.guy.load(...this.level[0])
  }

  lost () {
    return this.guy.bottom > HEIGHT || this.bars.some((bar) =>
      bar.on === this.on && bar.overlaps(this.guy)
    )
  }

  setBounds (body) {
    const {bounds} = body

    bounds.left = -body.left
    bounds.right = WIDTH - body.right
    bounds.top = -body.top
    bounds.bottom = HEIGHT - body.bottom + 1

    for (const bar of this.bars) {
      if (bar.spike || bar.on !== this.on) continue

      if (bar.top < body.bottom && bar.bottom > body.top) {
        if (bar.isRightOf(body)) {
          bounds.right = Math.min(bounds.right, bar.left - body.right)
        } else if (bar.isLeftOf(body)) {
          bounds.left = Math.max(bounds.left, bar.right - body.left)
        }
      }

      if (bar.left < body.right && bar.right > body.left) {
        if (bar.isBelow(body)) {
          bounds.bottom = Math.min(bounds.bottom, bar.top - body.bottom)
        } else if (bar.isAbove(body)) {
          bounds.top = Math.max(bounds.top, bar.bottom - body.top)
        }
      }
    }

    return bounds
  }

  tick (scale) {
    if (this.paused || this.hidden) return

    this.guy.tick(scale)

    const {left, right} = this.setBounds(this.guy)
    this.guy.x += Math.min(right, Math.max(left, this.guy.vx))

    const {top, bottom} = this.setBounds(this.guy)
    this.guy.y += Math.min(bottom, Math.max(top, this.guy.vy))

    if (bottom === 0) {
      this.guy.vy = upKey ? -scale(1200) : 0
      if (upKey) JUMP_FX.play()
    } else {
      this.guy.vy = Math.min(scale(600), this.guy.vy + scale(120))
    }

    if (this.lost()) {
      this.death()
    } else if (this.guy.overlaps(this.goal)) {
      this.advance()
    }
  }
}

const scene = new Scene(levels)

document.addEventListener('keydown', ({key}) => {
  if (key === ' ') {
    scene.on = !scene.on

    if (scene.on) OFF_FX.play()
    if (!scene.on) ON_FX.play()
  }
})

const title = new Title({
  start: () => {
    title.hidden = true
    scene.hidden = false
  }
})

let previous = 0
requestAnimationFrame(function tick (time) {
  // To deal with different frame rates, we define per-second speeds and adjust
  // them according to the time since the last frame was rendered.
  const duration = time - previous
  scene.tick((value) => Math.round(value * duration / 1000))
  previous = time
  requestAnimationFrame(tick)
})
