import * as React from "react"
import {
  CloudFog,
  CloudRain,
  Cloud,
  HelpCircle,
  Map as MapIcon,
  Navigation,
  Sparkles,
  Sun,
  SunMoon,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import "@fontsource/press-start-2p/latin-400.css"
import "@fontsource/pixelify-sans/latin-400.css"
import "@fontsource/pixelify-sans/latin-600.css"
import { cn } from "@/lib/utils"
import type { AppProps } from "@/os/registry/apps"
import { Soundscape } from "./audio"
import { clockLabel, WEATHER_KINDS, type WeatherKind } from "./env"
import { Game, type Dialogue, type GameEvent } from "./game"
import { BOUNDS, PLACES } from "./geo"
import { NoSigns, SignAtlas, type Signs } from "./kit/signs"
import { drawMap, toMap, type MapFrame } from "./map"
import { FRIEND_NAME } from "./story"
import { buildPlan, type Plan } from "./world/plan"

const UI = "font-['Pixelify_Sans',ui-sans-serif,sans-serif]"
const TITLE = "font-['Press_Start_2P',monospace]"
const MUTE_KEY = "doon-muted"

/** A JRPG window: deep indigo glass, a gold double border, a soft drop shadow. */
const panel =
  "rounded-md border-2 border-[#e2c275] bg-[#1d1838]/90 text-[#f6ecd6] shadow-[0_0_0_2px_#2a1d10,0_8px_22px_#0009] outline outline-1 -outline-offset-[5px] outline-[#e2c275]/35 backdrop-blur-[2px]"
const chip =
  "pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border-2 border-[#e2c275] bg-[#1d1838]/90 text-[#ffe7a8] shadow-[0_0_0_2px_#2a1d10,0_4px_10px_#0008] transition-transform hover:-translate-y-px hover:text-white active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe7a8] disabled:opacity-40"
/** A button inside a window. */
const option =
  "rounded-sm border border-[#e2c275]/70 bg-[#2c2550] text-[#f6ecd6] hover:bg-[#3a3268] focus-visible:outline-2 focus-visible:outline-[#ffe7a8]"
const optionOn = "rounded-sm border border-[#e2c275] bg-[#e2c275] text-[#1d1838]"

const WEATHER_ICON: Record<WeatherKind, typeof Sun> = { clear: Sun, cloudy: Cloud, rain: CloudRain, mist: CloudFog }
const WEATHER_NAME: Record<WeatherKind, string> = { clear: "Clear", cloudy: "Cloudy", rain: "Rain", mist: "Winter fog" }

const TIME_PRESETS: [string, number][] = [
  ["Foggy dawn", 6 * 60 + 50],
  ["Noon", 12 * 60 + 15],
  ["Red sunset", 17 * 60 + 2],
  ["Blue hour", 17 * 60 + 40],
  ["Night", 21 * 60],
]

const readMuted = () => {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

/** A five-point star, for the quest on the minimap. */
function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = "#ffd36a"
  ctx.fill()
  ctx.strokeStyle = "#2a1d10"
  ctx.lineWidth = 1.2
  ctx.stroke()
}

const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches

type Phase = "loading" | "title" | "play" | "error"
type Toast = { id: number; title: string; sub?: string }

/**
 * Doon Diorama: one corner of Dehradun, from the ISBT down Turner Road to
 * Clement Town, as an isometric pixel-art world you can walk. A friend is
 * waiting at the lake.
 */
export default function DoonDiorama({ isPhone, isFocused, isVisible }: AppProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const gameRef = React.useRef<Game | null>(null)
  const planRef = React.useRef<Plan | null>(null)
  const soundRef = React.useRef<Soundscape | null>(null)
  const arrowRef = React.useRef<HTMLDivElement>(null)
  const distRef = React.useRef<HTMLSpanElement>(null)
  const friendTagRef = React.useRef<HTMLDivElement>(null)
  const friendBubbleRef = React.useRef<HTMLDivElement>(null)
  const clockRef = React.useRef<HTMLSpanElement>(null)
  const miniRef = React.useRef<HTMLCanvasElement>(null)
  const miniBase = React.useRef<{ canvas: HTMLCanvasElement; frame: MapFrame } | null>(null)
  const focusedRef = React.useRef(isFocused)
  focusedRef.current = isFocused

  const touch = React.useMemo(() => isPhone || isTouchDevice(), [isPhone])
  const [phase, setPhase] = React.useState<Phase>("loading")
  const phaseRef = React.useRef(phase)
  phaseRef.current = phase
  const [error, setError] = React.useState("")
  const [objective, setObjective] = React.useState<string | null>(null)
  const [banner, setBanner] = React.useState<{ name: string; note: string; id: number } | null>(null)
  const [place, setPlace] = React.useState("ISBT Dehradun")
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [dialogue, setDialogue] = React.useState<Dialogue | null>(null)
  const [typed, setTyped] = React.useState(0)
  const [prompt, setPrompt] = React.useState<{ label: string; verb: string } | null>(null)
  const [panelOpen, setPanelOpen] = React.useState<"map" | "time" | "help" | null>(null)
  const [weather, setWeather] = React.useState<WeatherKind | "auto">("auto")
  const [weatherNow, setWeatherNow] = React.useState<WeatherKind>("clear")
  const [minutes, setMinutes] = React.useState(16 * 60 + 45)
  const [timeSpeed, setTimeSpeed] = React.useState(1)
  const [muted, setMuted] = React.useState(readMuted)
  const [stick, setStick] = React.useState<{ x: number; y: number; dx: number; dy: number } | null>(null)

  const toast = React.useCallback((title: string, sub?: string) => {
    const id = Math.random()
    setToasts((t) => [...t.slice(-2), { id, title, sub }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const onEvent = React.useCallback(
    (e: GameEvent) => {
      const sound = soundRef.current
      switch (e.type) {
        case "place":
          setPlace(e.name)
          setBanner({ name: e.name, note: e.note, id: Math.random() })
          break
        case "objective":
          setObjective(e.text)
          if (e.text && phaseRef.current === "play") sound?.blip()
          break
        case "dialogue":
          setDialogue(e.dialogue)
          setTyped(0)
          if (e.dialogue) sound?.blip()
          break
        case "toast":
          toast(e.title, e.sub)
          break
        case "weather":
          setWeatherNow(e.kind)
          toast(WEATHER_NAME[e.kind], e.kind === "rain" ? "A shower rolls in off the hills." : e.kind === "mist" ? "Fog settles over the valley." : e.kind === "cloudy" ? "Clouds drift over from Mussoorie." : "The sky clears.")
          break
        case "thunder":
          sound?.thunder(e.delay, e.strength)
          break
        case "step":
          sound?.step(e.wet, e.run)
          break
        case "warp":
          setPanelOpen("map")
          break
        case "achievement":
          sound?.chime()
          toast(`★ ${e.title}`, "Free roam: the whole map is yours. Try the night, or the rain.")
          break
      }
    },
    [toast]
  )

  // Build the town once: fonts, then the sign atlas and the plan, then the renderer.
  React.useEffect(() => {
    let live = true
    const boot = async () => {
      try {
        if (document.fonts) {
          await Promise.race([
            Promise.all([document.fonts.load(`8px "Press Start 2P"`), document.fonts.load(`16px "Press Start 2P"`), document.fonts.load(`600 12px "Pixelify Sans"`)]),
            new Promise((r) => window.setTimeout(r, 2500)),
          ])
        }
        await new Promise((r) => window.setTimeout(r, 30))
        if (!live) return
        let atlas: SignAtlas | null = null
        let signs: Signs
        try {
          atlas = new SignAtlas()
          signs = atlas
        } catch {
          signs = new NoSigns()
        }
        const plan = buildPlan(signs)
        planRef.current = plan
        const game = new Game(canvasRef.current!, plan, signs, atlas?.texture ?? null, onEvent)
        gameRef.current = game
        if (import.meta.env.DEV) (window as unknown as { __doon: Game }).__doon = game
        const r = wrapRef.current!.getBoundingClientRect()
        game.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2))
        soundRef.current = new Soundscape()
        soundRef.current.setMuted(readMuted())
        setPhase("title")
      } catch (err) {
        console.error(err)
        setError(err instanceof Error && /WebGL/i.test(err.message) ? "This needs WebGL, which this browser or device doesn't offer." : String(err))
        setPhase("error")
      }
    }
    void boot()
    return () => {
      live = false
      gameRef.current?.dispose()
      gameRef.current = null
      soundRef.current?.dispose()
      soundRef.current = null
    }
    // Built once per window.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const wrap = wrapRef.current!
    const fit = () => {
      const r = wrap.getBoundingClientRect()
      gameRef.current?.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2))
    }
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // The loop: runs while the window can be seen (the title screen shows the live town too).
  React.useEffect(() => {
    if (!isVisible || (phase !== "title" && phase !== "play")) {
      soundRef.current?.suspend()
      return
    }
    soundRef.current?.resume()
    let raf = 0
    let last = performance.now()
    let hudT = 0
    let miniT = 0
    const tick = (now: number) => {
      const game = gameRef.current
      // The first frame's timestamp can be a little before `last`.
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000))
      last = now
      if (game) {
        if (phaseRef.current === "title") game.controls.move = [0, 0]
        game.update(dt)
        soundRef.current?.update(dt, game.env.state, game.surroundings())
        const h = game.hud
        if (arrowRef.current && distRef.current) {
          if (h.arrow && !h.arrow.onScreen) {
            arrowRef.current.style.opacity = "1"
            arrowRef.current.style.transform = `rotate(${h.arrow.angle}rad)`
            distRef.current.textContent = h.arrow.distance > 1000 ? `${(h.arrow.distance / 1000).toFixed(1)} km` : `${Math.round(h.arrow.distance)} m`
          } else {
            arrowRef.current.style.opacity = h.arrow ? "0.35" : "0"
            distRef.current.textContent = h.arrow ? `${Math.round(h.arrow.distance)} m` : ""
          }
        }
        if (friendTagRef.current) {
          const f = h.friend
          friendTagRef.current.style.opacity = f.visible && phaseRef.current === "play" ? "1" : "0"
          friendTagRef.current.style.transform = `translate(${Math.round(f.x)}px, ${Math.round(f.y)}px) translate(-50%, -100%)`
          if (friendBubbleRef.current) {
            friendBubbleRef.current.textContent = f.bubble ?? ""
            friendBubbleRef.current.style.display = f.bubble ? "block" : "none"
          }
        }
        if (clockRef.current) clockRef.current.textContent = clockLabel(game.env.minutes)
        hudT -= dt
        if (hudT <= 0) {
          hudT = 0.15
          setPrompt((p) => (p?.verb === h.prompt?.verb && p?.label === h.prompt?.label ? p : h.prompt))
          setMinutes(Math.floor(game.env.minutes))
        }
        miniT -= dt
        if (miniT <= 0) {
          miniT = 0.1
          drawMini()
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // drawMini reads refs only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, phase])

  // Typewriter for dialogue.
  React.useEffect(() => {
    if (!dialogue || typed >= dialogue.text.length) return
    const id = window.setTimeout(() => setTyped((n) => n + 2), 18)
    return () => window.clearTimeout(id)
  }, [dialogue, typed])

  /** The compass minimap: turns with the camera so up on it is up on screen. */
  const drawMini = () => {
    const c = miniRef.current
    const plan = planRef.current
    const game = gameRef.current
    if (!c || !plan || !game) return
    if (!miniBase.current) {
      const scale = 0.55
      const pad = 160
      const w = Math.ceil((BOUNDS.maxX - BOUNDS.minX) * scale) + pad * 2
      const h = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) * scale) + pad * 2
      const base = document.createElement("canvas")
      base.width = w
      base.height = h
      const frame: MapFrame = { cx: (BOUNDS.minX + BOUNDS.maxX) / 2, cz: (BOUNDS.minZ + BOUNDS.maxZ) / 2, scale, w, h }
      drawMap(base.getContext("2d")!, plan, frame, false)
      miniBase.current = { canvas: base, frame }
    }
    const { canvas: base, frame } = miniBase.current
    const h = game.hud
    const ctx = c.getContext("2d")!
    const size = c.width
    const R = size / 2
    const [px, py] = toMap(frame, [h.player.x, h.player.z])
    const rel = (p: [number, number]) => {
      const [x, y] = toMap(frame, p)
      return [x - px, y - py] as const
    }
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(R, R, R - 4, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = "#cfe3f2"
    ctx.fillRect(0, 0, size, size)
    ctx.translate(R, R)
    ctx.rotate(-h.bearing)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(base, -Math.round(px), -Math.round(py))
    // Your friend.
    const [fx, fy] = rel(h.friendAt)
    ctx.beginPath()
    ctx.arc(fx, fy, 4, 0, Math.PI * 2)
    ctx.fillStyle = "#ff7eb6"
    ctx.fill()
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 1.5
    ctx.stroke()
    // The quest: a gold star, pinned to the rim when it's further than the map shows.
    if (h.target) {
      let [tx, ty] = rel(h.target)
      const d = Math.hypot(tx, ty)
      const rim = R - 14
      if (d > rim) {
        tx = (tx / d) * rim
        ty = (ty / d) * rim
      }
      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(h.bearing)
      star(ctx, 6)
      ctx.restore()
    }
    ctx.restore()

    // You, in the middle, facing the way you walk.
    ctx.save()
    ctx.translate(R, R)
    ctx.rotate(Math.PI - h.player.heading - h.bearing)
    ctx.fillStyle = "#ffd36a"
    ctx.strokeStyle = "#2a1d10"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -7)
    ctx.lineTo(5, 6)
    ctx.lineTo(0, 3)
    ctx.lineTo(-5, 6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // A gold bezel with north marked on it.
    ctx.beginPath()
    ctx.arc(R, R, R - 3, 0, Math.PI * 2)
    ctx.strokeStyle = "#e2c275"
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(R, R, R - 7, 0, Math.PI * 2)
    ctx.strokeStyle = "#2a1d10aa"
    ctx.lineWidth = 1
    ctx.stroke()
    const nx = R - Math.sin(h.bearing) * (R - 10)
    const ny = R - Math.cos(h.bearing) * (R - 10)
    ctx.beginPath()
    ctx.arc(nx, ny, 7, 0, Math.PI * 2)
    ctx.fillStyle = "#a3243f"
    ctx.fill()
    ctx.fillStyle = "#fff4d6"
    ctx.font = `600 9px "Pixelify Sans", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("N", nx, ny + 0.5)
  }

  const start = React.useCallback(() => {
    soundRef.current?.start()
    gameRef.current?.start()
    setPhase("play")
    window.setTimeout(() => wrapRef.current?.focus({ preventScroll: true }), 0)
  }, [])

  const toggleMute = React.useCallback(() => {
    setMuted((m) => {
      const next = !m
      soundRef.current?.start()
      soundRef.current?.setMuted(next)
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0")
      } catch {
        /* non-fatal */
      }
      return next
    })
  }, [])

  const pickWeather = (k: WeatherKind | "auto") => {
    setWeather(k)
    gameRef.current?.setWeather(k)
    if (k !== "auto") setWeatherNow(k)
  }

  const setTime = (m: number) => {
    gameRef.current?.env.setMinutes(m)
    setMinutes(m)
  }

  const setSpeed = (s: number) => {
    const env = gameRef.current?.env
    if (!env) return
    env.paused = s === 0
    env.speed = s || env.speed
    setTimeSpeed(s)
  }

  // Keyboard, while this window has focus.
  React.useEffect(() => {
    if (phase !== "play") return
    const held = new Set<string>()
    const MOVE = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"])
    const apply = () => {
      const g = gameRef.current
      if (!g) return
      const has = (...k: string[]) => k.some((c) => held.has(c))
      g.controls.move = [(has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0), (has("KeyW", "ArrowUp") ? 1 : 0) - (has("KeyS", "ArrowDown") ? 1 : 0)]
      g.controls.run = has("ShiftLeft", "ShiftRight")
    }
    const down = (e: KeyboardEvent) => {
      if (!focusedRef.current || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") && (t as HTMLInputElement).type !== "range") return
      const g = gameRef.current
      if (!g) return
      let used = true
      if (MOVE.has(e.code)) {
        held.add(e.code)
        apply()
      } else if (e.repeat) {
        used = ["KeyE", "Space", "Enter"].includes(e.code)
      } else if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") {
        g.interact()
      } else if (e.code === "Equal" || e.code === "NumpadAdd") g.zoomBy(0.85)
      else if (e.code === "Minus" || e.code === "NumpadSubtract") g.zoomBy(1.18)
      else if (e.code === "KeyM") setPanelOpen((p) => (p === "map" ? null : "map"))
      else if (e.code === "KeyT") setPanelOpen((p) => (p === "time" ? null : "time"))
      else if (e.code === "KeyH") setPanelOpen((p) => (p === "help" ? null : "help"))
      else if (e.code === "KeyV") toggleMute()
      else if (e.code === "Escape") setPanelOpen(null)
      else if (/^Digit[1-4]$/.test(e.code)) {
        const choices = dialogueRef.current?.choices
        const c = choices?.[Number(e.code.slice(5)) - 1]
        if (c) g.pick(c.id)
        else used = false
      } else used = false
      if (used) {
        // Claim the key before the desktop's own shortcuts.
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (!held.has(e.code)) return
      held.delete(e.code)
      apply()
    }
    const clear = () => {
      held.clear()
      apply()
    }
    window.addEventListener("keydown", down, true)
    window.addEventListener("keyup", up, true)
    window.addEventListener("blur", clear)
    return () => {
      window.removeEventListener("keydown", down, true)
      window.removeEventListener("keyup", up, true)
      window.removeEventListener("blur", clear)
      clear()
    }
  }, [phase, toggleMute])

  const dialogueRef = React.useRef(dialogue)
  dialogueRef.current = dialogue

  React.useEffect(() => {
    if (!isFocused && gameRef.current) gameRef.current.controls.move = [0, 0]
  }, [isFocused])

  // Wheel to zoom.
  React.useEffect(() => {
    const wrap = wrapRef.current!
    const onWheel = (e: WheelEvent) => {
      if (phaseRef.current !== "play" || panelOpen) return
      e.preventDefault()
      gameRef.current?.zoomBy(e.deltaY > 0 ? 1.1 : 0.9)
    }
    wrap.addEventListener("wheel", onWheel, { passive: false })
    return () => wrap.removeEventListener("wheel", onWheel)
  }, [panelOpen])

  // Touch joystick: anywhere on the left half.
  const stickId = React.useRef<number | null>(null)
  const onStickDown = (e: React.PointerEvent) => {
    if (!touch || phase !== "play" || stickId.current !== null) return
    stickId.current = e.pointerId
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 })
  }
  const onStickMove = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current || !stick) return
    const dx = e.clientX - stick.x
    const dy = e.clientY - stick.y
    const R = 46
    const l = Math.hypot(dx, dy)
    const k = l > R ? R / l : 1
    setStick({ ...stick, dx: dx * k, dy: dy * k })
    const g = gameRef.current
    if (g) {
      g.controls.move = [(dx * k) / R, -(dy * k) / R]
      g.controls.run = l > R * 1.35
    }
  }
  const onStickUp = (e: React.PointerEvent) => {
    if (e.pointerId !== stickId.current) return
    stickId.current = null
    setStick(null)
    const g = gameRef.current
    if (g) {
      g.controls.move = [0, 0]
      g.controls.run = false
    }
  }

  // Drag to look around: turn the camera round you and tilt it. A tap without a drag still advances dialogue.
  const look = React.useRef<{ id: number; x: number; y: number; moved: number } | null>(null)
  const onLookDown = (e: React.PointerEvent) => {
    if (phase !== "play" || look.current) return
    look.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onLookMove = (e: React.PointerEvent) => {
    const l = look.current
    if (!l || e.pointerId !== l.id) return
    const dx = e.clientX - l.x
    const dy = e.clientY - l.y
    l.x = e.clientX
    l.y = e.clientY
    l.moved += Math.abs(dx) + Math.abs(dy)
    if (l.moved > 4) gameRef.current?.orbit(dx * 0.009, dy * 0.006)
  }
  const onLookUp = (e: React.PointerEvent) => {
    const l = look.current
    if (!l || e.pointerId !== l.id) return
    look.current = null
    if (l.moved <= 4 && dialogueRef.current && !dialogueRef.current.choices) gameRef.current?.interact()
  }
  const [grabbing, setGrabbing] = React.useState(false)

  const WeatherIcon = WEATHER_ICON[weatherNow]
  const shown = dialogue ? dialogue.text.slice(0, typed) : ""
  const textDone = dialogue ? typed >= dialogue.text.length : true

  return (
    <div
      ref={wrapRef}
      tabIndex={-1}
      className={cn("relative h-full min-h-[360px] select-none overflow-hidden bg-[#0d0f1c] text-[#fff8e8] outline-none", UI)}
      onPointerDown={() => wrapRef.current?.focus({ preventScroll: true })}
    >
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0 size-full touch-none [image-rendering:pixelated]", phase === "play" && (grabbing ? "cursor-grabbing" : "cursor-grab"))}
        role="img"
        aria-label="An isometric pixel-art Dehradun on a floating island: the ISBT, Shimla Bypass Chowk, Turner Road, Clement Town Cantonment, its lake and Mindrolling Monastery. Drag to look around."
        onPointerDown={(e) => {
          onLookDown(e)
          setGrabbing(true)
        }}
        onPointerMove={onLookMove}
        onPointerUp={(e) => {
          onLookUp(e)
          setGrabbing(false)
        }}
        onPointerCancel={(e) => {
          onLookUp(e)
          setGrabbing(false)
        }}
      />

      {/* Touch: the left half is a joystick, the right half looks around. */}
      {touch && phase === "play" && !panelOpen && (
        <>
          <div className="absolute inset-y-0 left-0 z-10 w-1/2 touch-none" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp} />
          <div className="absolute inset-y-0 right-0 z-10 w-1/2 touch-none" onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={onLookUp} onPointerCancel={onLookUp} />
        </>
      )}
      {stick && (
        <div className="pointer-events-none fixed z-20" style={{ left: stick.x - 44, top: stick.y - 44 }}>
          <div className="size-[88px] rounded-full border-2 border-[#fff8e8]/50 bg-black/20" />
          <div className="absolute left-[30px] top-[30px] size-7 rounded-full border-2 border-[#e2c275] bg-[#1d1838]" style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      )}

      {/* Friend's name tag and speech bubble. */}
      <div ref={friendTagRef} className="pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-center opacity-0 transition-opacity">
        <div ref={friendBubbleRef} className={cn(panel, "mb-1 hidden max-w-44 px-2 py-1 text-center text-xs leading-tight")} />
        <span className="rounded-sm border border-[#ffd36a] bg-[#8e1b3a] px-1.5 py-px text-[0.625rem] tracking-wide text-[#fff8e8] shadow-[0_0_8px_#ff9ec4aa]">✦ {FRIEND_NAME}</span>
      </div>

      {phase === "play" && (
        <>
          {/* Top left: where you are, the time, the objective. */}
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[calc(100%-12.75rem)] flex-col gap-2 sm:max-w-[22rem]">
            <div className={cn(panel, "px-3 py-2")}>
              <p className="text-sm font-semibold leading-tight">{place}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#c8bba0]">
                <WeatherIcon className="size-3.5" aria-hidden />
                <span ref={clockRef}>{clockLabel(minutes)}</span>
                <span aria-hidden>·</span>
                <span>{WEATHER_NAME[weatherNow]}</span>
              </p>
            </div>
            {objective && (
              <div className={cn(panel, "flex items-center gap-2 px-3 py-1.5")}>
                <div ref={arrowRef} className="shrink-0 text-[#ffd36a] transition-opacity" aria-hidden>
                  <Navigation className="size-4 fill-current" />
                </div>
                <p className="text-xs leading-tight">
                  <span className="mr-1 text-[0.625rem] tracking-widest text-[#ffd36a]">QUEST</span>
                  {objective} <span ref={distRef} className="text-[#ffd36a]" />
                </p>
              </div>
            )}
          </div>

          {/* Top right: tools. */}
          <div className="absolute right-3 top-3 z-20 flex gap-1.5">
            <button type="button" className={chip} onClick={() => setPanelOpen((p) => (p === "map" ? null : "map"))} aria-label="Map and fast travel (M)" title="Map · M">
              <MapIcon className="size-4" aria-hidden />
            </button>
            <button type="button" className={chip} onClick={() => setPanelOpen((p) => (p === "time" ? null : "time"))} aria-label="Time and weather (T)" title="Time & weather · T">
              <SunMoon className="size-4" aria-hidden />
            </button>
            <button type="button" className={chip} onClick={toggleMute} aria-label={muted ? "Sound on (V)" : "Sound off (V)"} title="Sound · V">
              {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
            </button>
            <button type="button" className={chip} onClick={() => setPanelOpen((p) => (p === "help" ? null : "help"))} aria-label="Controls (H)" title="Controls · H">
              <HelpCircle className="size-4" aria-hidden />
            </button>
          </div>

          {/* Bottom right: minimap, camera controls. */}
          <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5">
            <div className="flex gap-1.5">
              <button type="button" className={chip} onClick={() => gameRef.current?.zoomBy(0.8)} aria-label="Zoom in (+)" title="Zoom in · +">
                <ZoomIn className="size-4" aria-hidden />
              </button>
              <button type="button" className={chip} onClick={() => gameRef.current?.zoomBy(1.25)} aria-label="Zoom out (−)" title="Zoom out · −">
                <ZoomOut className="size-4" aria-hidden />
              </button>
            </div>
            <canvas
              ref={miniRef}
              width={144}
              height={144}
              onClick={() => setPanelOpen("map")}
              className="pointer-events-auto size-[104px] cursor-pointer rounded-full shadow-[0_0_0_2px_#2a1d10,0_6px_16px_#0009] sm:size-36"
              aria-label="Minimap: open the map"
            />
          </div>

          {/* Place banner. */}
          {banner && (
            <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-[18%] z-10 flex animate-[doon-banner_3.2s_ease-out_forwards] flex-col items-center text-center">
              <p className="text-[0.625rem] tracking-[0.4em] text-[#ffe7a8] [text-shadow:0_0_6px_#000]">✦ AREA ✦</p>
              <p className={cn(TITLE, "mt-2 text-[0.8rem] text-[#fff4d6] [text-shadow:0_0_10px_#ffb84a,2px_2px_0_#2a1d10] sm:text-base")}>{banner.name}</p>
              <div className="mt-2 h-px w-48 bg-gradient-to-r from-transparent via-[#e2c275] to-transparent" />
              <p className="mt-1.5 text-xs text-[#fff8e8]/90 [text-shadow:1px_1px_0_#2a1d10]">{banner.note}</p>
            </div>
          )}

          {/* Toasts. */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden w-72 -translate-x-1/2 flex-col gap-1.5 md:flex">
            {toasts.map((t) => (
              <div key={t.id} className={cn(panel, "animate-[doon-toast_0.25s_ease-out] px-3 py-1.5 text-center")}>
                <p className="text-xs font-semibold">{t.title}</p>
                {t.sub && <p className="text-[0.6875rem] leading-tight text-[#c8bba0]">{t.sub}</p>}
              </div>
            ))}
          </div>

          {/* What E does here. */}
          {prompt && !dialogue && !panelOpen && (
            <button
              type="button"
              onClick={() => gameRef.current?.interact()}
              className={cn(panel, "pointer-events-auto absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 px-3 py-2 text-sm")}
            >
              {!touch && <kbd className="rounded-sm border border-[#e2c275] bg-[#e2c275] px-1.5 text-[0.625rem] text-[#1d1838]">E</kbd>}
              <span>
                {prompt.verb} <span className="text-[#c8bba0]">· {prompt.label}</span>
              </span>
            </button>
          )}

          {/* Dialogue. */}
          {dialogue && (
            <div className="absolute inset-x-3 bottom-3 z-30 mx-auto max-w-xl">
              <div
                className={cn(panel, "cursor-pointer px-4 py-3")}
                onClick={() => {
                  if (!textDone) setTyped(dialogue.text.length)
                  else if (!dialogue.choices) gameRef.current?.interact()
                }}
              >
                {dialogue.speaker && (
                  <p className={cn("mb-1 text-xs font-semibold", dialogue.who === "friend" ? "text-[#ff9ec4]" : "text-[#8fe8f0]")}>{dialogue.speaker}</p>
                )}
                <p className={cn("min-h-[2.5rem] text-sm leading-snug", dialogue.who === "narrator" && "italic text-[#c8bba0]")}>
                  {shown}
                  <span className="sr-only">{dialogue.text.slice(typed)}</span>
                </p>
                {textDone && dialogue.choices ? (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {dialogue.choices.map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(option, "px-2 py-1 text-left text-xs")}
                        onClick={(e) => {
                          e.stopPropagation()
                          gameRef.current?.pick(c.id)
                        }}
                      >
                        {!touch && <span className="mr-1.5 text-[#ffd36a]">{i + 1}</span>}
                        {c.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  textDone && <p className="mt-1 text-right text-[0.625rem] text-[#c8bba0]">{touch ? "tap" : "E / click"} ▸</p>
                )}
              </div>
            </div>
          )}

          {/* Touch action button. */}
          {touch && !dialogue && (
            <button
              type="button"
              className={cn(chip, "absolute bottom-8 right-[8.5rem] z-20 size-14 rounded-full text-xs font-semibold")}
              onClick={() => gameRef.current?.interact()}
              disabled={!prompt}
              aria-label={prompt ? `${prompt.verb}: ${prompt.label}` : "Nothing to do here"}
            >
              {prompt ? "Use" : "·"}
            </button>
          )}
        </>
      )}

      {/* Panels. */}
      {phase === "play" && panelOpen === "map" && planRef.current && (
        <MapPanel
          plan={planRef.current}
          player={gameRef.current ? [gameRef.current.hud.player.x, gameRef.current.hud.player.z] : [0, 0]}
          onClose={() => setPanelOpen(null)}
          onTravel={(id) => {
            gameRef.current?.travel(id)
            setPanelOpen(null)
          }}
        />
      )}
      {phase === "play" && panelOpen === "time" && (
        <div className={cn(panel, "absolute right-3 top-14 z-30 w-72 p-3")}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Time &amp; weather</p>
            <button type="button" onClick={() => setPanelOpen(null)} aria-label="Close">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <label className="flex items-baseline justify-between text-xs" htmlFor="doon-time">
            <span>Time of day</span>
            <span className="font-semibold">{clockLabel(minutes)}</span>
          </label>
          <input
            id="doon-time"
            type="range"
            min={0}
            max={1439}
            value={minutes}
            onChange={(e) => setTime(Number(e.target.value))}
            className="mt-1 h-1 w-full cursor-pointer accent-[#e2c275]"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {TIME_PRESETS.map(([label, m]) => (
              <button key={label} type="button" onClick={() => setTime(m)} className={cn(option, "px-1.5 py-0.5 text-[0.6875rem]")}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs">Clock speed</p>
          <div className="mt-1 flex gap-1">
            {[
              [0, "Hold"],
              [1, "1 min/s"],
              [6, "6×"],
              [30, "30×"],
            ].map(([s, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setSpeed(s as number)}
                aria-pressed={timeSpeed === s}
                className={cn("flex-1 px-1 py-0.5 text-[0.6875rem]", timeSpeed === s ? optionOn : option)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs">Weather</p>
          <div className="mt-1 grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => pickWeather("auto")}
              aria-pressed={weather === "auto"}
              className={cn("flex flex-col items-center gap-0.5 px-1 py-1 text-[0.625rem]", weather === "auto" ? optionOn : option)}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Auto
            </button>
            {WEATHER_KINDS.map((k) => {
              const Icon = WEATHER_ICON[k]
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickWeather(k)}
                  aria-pressed={weather === k}
                  className={cn("flex flex-col items-center gap-0.5 px-1 py-1 text-[0.625rem]", weather === k ? optionOn : option)}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {k === "mist" ? "Fog" : WEATHER_NAME[k]}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[0.6875rem] leading-tight text-[#c8bba0]">
            The sun follows real December geometry for Dehradun: it sets at about 5:20 pm. In Auto the weather turns every few game hours.
          </p>
        </div>
      )}
      {phase === "play" && panelOpen === "help" && (
        <div className={cn(panel, "absolute right-3 top-14 z-30 w-72 p-3 text-xs")}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Controls</p>
            <button type="button" onClick={() => setPanelOpen(null)} aria-label="Close">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {(touch
              ? [
                  ["Left half", "drag to walk, far to run"],
                  ["Right half", "drag to turn and tilt the camera"],
                  ["Use", "talk, buy, warp"],
                ]
              : [
                  ["WASD / ←↑↓→", "walk"],
                  ["Shift", "run"],
                  ["E / Space", "talk, buy, next line"],
                  ["1 – 4", "pick a reply"],
                  ["Drag", "turn and tilt the camera"],
                  ["+ / − / wheel", "zoom"],
                  ["M", "map and fast travel"],
                  ["T", "time and weather"],
                  ["V", "sound"],
                ]
            ).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="font-semibold">{k}</dt>
                <dd className="text-[#c8bba0]">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="mt-3 leading-tight text-[#c8bba0]">
            The roads follow the real ones from surveyed points: ISBT, the chowk, Turner Road, the cantonment gate. Buildings between the landmarks are generated. Step up to a warp crystal to travel.
          </p>
        </div>
      )}

      {/* Title. */}
      {(phase === "loading" || phase === "title") && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-[#0d0f1c]/70 via-[#0d0f1c]/20 to-[#0d0f1c]/80 p-6 text-center">
          <p className="text-xs tracking-[0.3em] text-[#ffe7a8]/90 [text-shadow:0_0_8px_#000]">✦ DEHRADUN · UTTARAKHAND ✦</p>
          <h1 className={cn(TITLE, "mt-3 text-xl leading-snug text-[#fff4d6] [text-shadow:0_0_14px_#ffb84a,3px_3px_0_#5a2a6a] sm:text-3xl")}>Doon Diorama</h1>
          <p className="mt-2 text-xs tracking-wide text-[#c8b8ff] [text-shadow:0_0_6px_#000]">a little isekai on a floating Dehradun</p>
          <p className="mt-3 max-w-md text-sm text-[#fff8e8]/90 [text-shadow:1px_1px_0_#000]">
            ISBT → Shimla Bypass Chowk → Turner Road → Clement Town. A winter evening, and {FRIEND_NAME} is waiting by the lake.
          </p>
          {phase === "loading" ? (
            <p className="mt-6 animate-pulse text-xs text-[#fff8e8]/80">Laying out Turner Road…</p>
          ) : (
            <button
              type="button"
              onClick={start}
              className="mt-6 rounded-md border-2 border-[#fff1c0] bg-gradient-to-b from-[#ffd36a] to-[#e09a2a] px-6 py-2.5 text-sm font-semibold text-[#2a1d10] shadow-[0_0_0_2px_#2a1d10,0_0_24px_#ffb84a88] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
              autoFocus
            >
              Start walking
            </button>
          )}
          <p className="mt-4 text-[0.6875rem] text-[#fff8e8]/60">{touch ? "Left: walk · right: look around · Use to talk" : "WASD to walk · drag to look around · E to talk · Shift to run"}</p>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 z-40 grid place-items-center p-6 text-center">
          <p className={cn(panel, "max-w-sm px-4 py-3 text-sm")}>{error || "Something went wrong building the town."}</p>
        </div>
      )}

      <style>{`
        @keyframes doon-banner { 0% { opacity: 0; transform: translateY(6px) } 12% { opacity: 1; transform: none } 75% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes doon-toast { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}

function MapPanel({ plan, player, onClose, onTravel }: { plan: Plan; player: [number, number]; onClose: () => void; onTravel: (id: string) => void }) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const boxRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const c = ref.current!
    const box = boxRef.current!.getBoundingClientRect()
    const w = Math.max(200, Math.floor(box.width))
    const h = Math.max(200, Math.floor(box.height))
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = w * dpr
    c.height = h * dpr
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    const ctx = c.getContext("2d")!
    ctx.scale(dpr, dpr)
    const scale = Math.min(w / (BOUNDS.maxX - BOUNDS.minX + 60), h / (BOUNDS.maxZ - BOUNDS.minZ + 60))
    const frame: MapFrame = { cx: (BOUNDS.minX + BOUNDS.maxX) / 2, cz: (BOUNDS.minZ + BOUNDS.maxZ) / 2, scale, w, h }
    drawMap(ctx, plan, frame)
    const [x, y] = toMap(frame, player)
    ctx.fillStyle = "#c0392b"
    ctx.strokeStyle = "#fff8e8"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = "#3a2a1a"
    ctx.font = `600 11px "Pixelify Sans", sans-serif`
    ctx.fillText("You", x + 8, y + 4)
    // Scale bar: 250 m.
    ctx.fillRect(14, h - 18, 250 * scale, 3)
    ctx.fillText("250 m", 14, h - 24)
  }, [plan, player])

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-3" onClick={onClose}>
      <div className={cn(panel, "flex h-full max-h-[640px] w-full max-w-3xl flex-col gap-2 p-3 @container")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Clement Town &amp; Majra · map</p>
          <button type="button" onClick={onClose} aria-label="Close the map">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 @xl:flex-row">
          <div ref={boxRef} className="min-h-[220px] flex-1 border border-[#3a2a1a]">
            <canvas ref={ref} className="block" />
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5 @xl:w-48 @xl:flex-col">
            <p className="w-full text-xs text-[#c8bba0]">Go to</p>
            {PLACES.filter((p) => p.travel).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onTravel(p.id)}
                className={cn(option, "px-2 py-1 text-left text-xs")}
              >
                <span className="font-semibold">{p.name}</span>
                <span className="block text-[0.625rem] text-[#c8bba0]">{p.note}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
