import * as React from "react"
import { useReducedMotion } from "motion/react"
import { ArrowUp, Drum, Guitar, Music2, Pause, SlidersHorizontal, Volume2, VolumeX } from "lucide-react"
import "@fontsource/cormorant-garamond/latin-400-italic.css"
import "@fontsource/cormorant-garamond/latin-500.css"
import { cn } from "@/lib/utils"
import type { AppProps } from "@/os/registry/apps"
import { CastleAudio, DEFAULT_MIX, type Mix } from "./audio"
import { LANDMARK_NAMES, Game, type GameEvent, type Phase, type Stats } from "./game"
import { bindKeyboard, bindMouse, bindTouch, type SoundKey } from "./input"
import { Output } from "./render/output"
import { LANDMARKS, type Landmark } from "./castle"

const SERIF = "font-['Cormorant_Garamond',Georgia,serif]"
const KANJI = "font-['Noto_Serif_JP','Yu_Mincho','Hiragino_Mincho_ProN',serif]"
const MUTE_KEY = "infinity-castle-muted"
const MUSIC_KEY = "infinity-castle-music-off"
const BIWA_KEY = "infinity-castle-biwa-off"
const VOLUME_KEYS = { volume: "infinity-castle-volume", musicVolume: "infinity-castle-music-volume", biwaVolume: "infinity-castle-biwa-volume" } as const

type Toast = { id: number; title: string; sub?: string }

const chip =
  "pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-[#e0a25a]/30 bg-black/40 text-[#f3e3c6]/85 backdrop-blur-sm transition-colors hover:border-[#e0a25a]/70 hover:text-[#f3e3c6] focus-visible:outline-2 focus-visible:outline-[#e0a25a]"

const readFlag = (key: string) => {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

const writeFlag = (key: string, on: boolean) => {
  try {
    window.localStorage.setItem(key, on ? "1" : "0")
  } catch {
    /* non-fatal */
  }
}

const readNumber = (key: string, fallback: number) => {
  try {
    const v = window.localStorage.getItem(key)
    const n = v === null ? NaN : Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
  } catch {
    return fallback
  }
}

const writeNumber = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    /* non-fatal */
  }
}

/** The saved mix: what's muted, and how loud each part is. */
const readMix = (): Mix => ({
  muted: readFlag(MUTE_KEY),
  music: !readFlag(MUSIC_KEY),
  biwa: !readFlag(BIWA_KEY),
  volume: readNumber(VOLUME_KEYS.volume, DEFAULT_MIX.volume),
  musicVolume: readNumber(VOLUME_KEYS.musicVolume, DEFAULT_MIX.musicVolume),
  biwaVolume: readNumber(VOLUME_KEYS.biwaVolume, DEFAULT_MIX.biwaVolume),
})

const writeMix = (mix: Mix) => {
  writeFlag(MUTE_KEY, mix.muted)
  writeFlag(MUSIC_KEY, !mix.music)
  writeFlag(BIWA_KEY, !mix.biwa)
  for (const k of ["volume", "musicVolume", "biwaVolume"] as const) writeNumber(VOLUME_KEYS[k], mix[k])
}

/**
 * Mutes and volumes, separately: the biwa strums that reshape the castle,
 * the music, and everything at once.
 */
function SoundPanel({ mix, onChange, className }: { mix: Mix; onChange: (m: Partial<Mix>) => void; className?: string }) {
  const rows = [
    {
      key: "biwa",
      label: "Biwa strums",
      hint: "when the castle shifts · B",
      on: mix.biwa,
      volume: mix.biwaVolume,
      icon: Guitar,
      toggle: () => onChange({ biwa: !mix.biwa }),
      set: (v: number) => onChange({ biwaVolume: v, biwa: v > 0 }),
    },
    {
      key: "music",
      label: "Music",
      hint: "the chase score · N",
      on: mix.music,
      volume: mix.musicVolume,
      icon: Drum,
      toggle: () => onChange({ music: !mix.music }),
      set: (v: number) => onChange({ musicVolume: v, music: v > 0 }),
    },
    {
      key: "all",
      label: "All sound",
      hint: "everything · M",
      on: !mix.muted,
      volume: mix.volume,
      icon: mix.muted ? VolumeX : Volume2,
      toggle: () => onChange({ muted: !mix.muted }),
      set: (v: number) => onChange({ volume: v, muted: v === 0 }),
    },
  ]
  return (
    <div
      className={cn(
        "pointer-events-auto w-64 space-y-3 rounded-xl border border-[#e0a25a]/30 bg-[#0d0705]/85 p-3 text-left text-[#f3e3c6] shadow-[0_8px_30px_#000a] backdrop-blur-md",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {rows.map((r) => {
        const Icon = r.icon
        const id = `ic-sound-${r.key}`
        return (
          <div key={r.key} className="flex items-center gap-3">
            <button
              type="button"
              onClick={r.toggle}
              aria-pressed={r.on}
              aria-label={`${r.label}: ${r.on ? "on" : "off"}`}
              title={r.on ? `Mute ${r.label.toLowerCase()}` : `Unmute ${r.label.toLowerCase()}`}
              className={cn(chip, "size-8 shrink-0", !r.on && "text-[#f3e3c6]/35 line-through")}
            >
              <Icon className="size-4" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <label htmlFor={id} className="flex items-baseline justify-between text-xs">
                <span className={cn(!r.on && "text-[#f3e3c6]/45")}>{r.label}</span>
                <span className="text-[0.625rem] text-[#f3e3c6]/40">{r.on ? `${Math.round(r.volume * 100)}%` : "off"}</span>
              </label>
              <input
                id={id}
                type="range"
                min={0}
                max={100}
                value={Math.round((r.on ? r.volume : 0) * 100)}
                onChange={(e) => r.set(Number(e.target.value) / 100)}
                className="mt-1 h-1 w-full cursor-pointer accent-[#e0a25a]"
              />
              <p className="mt-0.5 text-[0.625rem] text-[#f3e3c6]/35">{r.hint}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches

/**
 * Infinity Castle: Muzan's fortress from Demon Slayer, walkable. Rooms on
 * a lattice in a bottomless void, joined by bridges, corridors and long
 * stairs; every few dozen steps Nakime strums her biwa and the castle
 * rearranges itself around you.
 */
export default function InfinityCastle({ isPhone, isFocused, isVisible }: AppProps) {
  const reduced = useReducedMotion() ?? false
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const touchRef = React.useRef<HTMLDivElement>(null)
  const scentRef = React.useRef<HTMLDivElement>(null)
  const scentLabelRef = React.useRef<HTMLParagraphElement>(null)
  const gameRef = React.useRef<Game | null>(null)
  const outputRef = React.useRef<Output | null>(null)
  const audioRef = React.useRef<CastleAudio | null>(null)
  const pausedRef = React.useRef(false)
  const focusedRef = React.useRef(isFocused)
  const noLockRef = React.useRef(false)

  const touch = React.useMemo(() => isPhone || isTouchDevice(), [isPhone])
  const [phase, setPhase] = React.useState<Phase>("title")
  const [error, setError] = React.useState<string | null>(null)
  const [paused, setPaused] = React.useState(false)
  const [mix, setMixState] = React.useState(readMix)
  const [soundOpen, setSoundOpen] = React.useState(false)
  const [found, setFound] = React.useState<Landmark[]>([])
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const [titlecard, setTitlecard] = React.useState(false)
  const [beben, setBeben] = React.useState(0)
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [dropping, setDropping] = React.useState(false)
  const [stick, setStick] = React.useState<{ x: number; y: number; dx: number; dy: number } | null>(null)

  const playing = phase === "intro" || phase === "play"
  const playingRef = React.useRef(playing)
  playingRef.current = playing
  focusedRef.current = isFocused

  const onEvent = React.useCallback((e: GameEvent) => {
    switch (e.type) {
      case "toast": {
        const id = Math.random()
        setToasts((t) => [...t.slice(-2), { id, title: e.title, sub: e.sub }])
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600)
        break
      }
      case "found":
        setFound(e.found)
        break
      case "phase":
        setPhase(e.phase)
        break
      case "strum":
        setBeben((n) => n + 1)
        break
      case "titlecard":
        setTitlecard(true)
        window.setTimeout(() => setTitlecard(false), 3400)
        break
      case "drop":
        setDropping(e.active)
        break
      case "ended":
        setStats(e.stats)
        document.exitPointerLock?.()
        break
    }
  }, [])

  const newGame = React.useCallback(() => {
    gameRef.current?.dispose()
    const game = new Game(Math.floor(Math.random() * 1e9), outputRef.current!, audioRef.current!, onEvent)
    game.reduced = reduced
    const wrap = wrapRef.current!
    game.setAspect(wrap.clientWidth / Math.max(1, wrap.clientHeight))
    gameRef.current = game
    if (import.meta.env.DEV) (window as unknown as { __castle: Game }).__castle = game
    return game
  }, [onEvent, reduced])

  // Renderer, sound and the first castle, once per window.
  React.useEffect(() => {
    try {
      outputRef.current = new Output(canvasRef.current!, { phone: touch })
      outputRef.current.motion = reduced ? 0 : 1
    } catch {
      setError("This needs WebGL 2, which this browser or device doesn't offer.")
      return
    }
    audioRef.current = new CastleAudio()
    audioRef.current.setMix(readMix())
    newGame()
    return () => {
      gameRef.current?.dispose()
      gameRef.current = null
      audioRef.current?.dispose()
      outputRef.current?.dispose()
      outputRef.current = null
    }
    // Built once; `touch` and `reduced` don't change under a window.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const wrap = wrapRef.current!
    const fit = () => {
      const r = wrap.getBoundingClientRect()
      outputRef.current?.resize(r.width, r.height, window.devicePixelRatio || 1)
      gameRef.current?.setAspect(r.width / Math.max(1, r.height))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // The loop: runs while the window can be seen and the game isn't paused.
  React.useEffect(() => {
    if (!isVisible || paused || error) {
      audioRef.current?.suspend()
      return
    }
    audioRef.current?.resume()
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const game = gameRef.current
      if (game) {
        game.update((now - last) / 1000)
        const h = game.hud
        if (scentRef.current && scentLabelRef.current) {
          scentRef.current.style.transform = `rotate(${h.scent}rad)`
          scentRef.current.style.opacity = h.ahead ? "0.25" : "0.95"
          scentLabelRef.current.textContent = h.target ? `${h.target} · ${Math.round(h.distance)} m` : ""
        }
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isVisible, paused, error])

  const lock = React.useCallback(() => {
    if (touch || noLockRef.current) return
    const canvas = canvasRef.current
    try {
      const p = canvas?.requestPointerLock?.() as unknown as Promise<void> | undefined
      p?.catch?.(() => (noLockRef.current = true))
    } catch {
      noLockRef.current = true
    }
  }, [touch])

  const pause = React.useCallback((value: boolean) => {
    pausedRef.current = value
    setPaused(value)
  }, [])

  // Losing the pointer (Esc) or the window's focus pauses the walk.
  React.useEffect(() => {
    const onChange = () => {
      if (document.pointerLockElement !== canvasRef.current && playingRef.current && !touch && !noLockRef.current) pause(true)
    }
    const onError = () => (noLockRef.current = true)
    document.addEventListener("pointerlockchange", onChange)
    document.addEventListener("pointerlockerror", onError)
    return () => {
      document.removeEventListener("pointerlockchange", onChange)
      document.removeEventListener("pointerlockerror", onError)
    }
  }, [pause, touch])

  React.useEffect(() => {
    if (!isFocused && playingRef.current) {
      if (document.pointerLockElement === canvasRef.current) document.exitPointerLock()
      pause(true)
    }
  }, [isFocused, pause])

  const changeMix = React.useCallback((change: Partial<Mix>) => {
    setMixState((was) => {
      const next = { ...was, ...change }
      audioRef.current?.setMix(next)
      writeMix(next)
      return next
    })
  }, [])

  const soundKey = React.useCallback(
    (key: SoundKey) =>
      setMixState((was) => {
        const next = { ...was }
        if (key === "biwa") next.biwa = !was.biwa
        else if (key === "music") next.music = !was.music
        else next.muted = !was.muted
        audioRef.current?.setMix(next)
        writeMix(next)
        const label = key === "biwa" ? "Biwa strums" : key === "music" ? "Music" : "Sound"
        const on = key === "biwa" ? next.biwa : key === "music" ? next.music : !next.muted
        onEvent({ type: "toast", title: `${label} ${on ? "on" : "off"}` })
        return next
      }),
    [onEvent]
  )

  React.useEffect(() => {
    const controls = () => gameRef.current?.input
    const opts = {
      get controls() {
        return controls()!
      },
      active: () => Boolean(gameRef.current) && playingRef.current && !pausedRef.current && focusedRef.current,
      onStrum: () => gameRef.current?.strum({ manual: true }),
      onSound: soundKey,
      onStick: setStick,
    }
    const offKeys = bindKeyboard(opts)
    const offMouse = bindMouse(canvasRef.current!, opts)
    const offTouch = touch ? bindTouch(touchRef.current!, opts) : () => {}
    return () => {
      offKeys()
      offMouse()
      offTouch()
    }
  }, [touch, soundKey])

  const enter = () => {
    audioRef.current?.start()
    const game = phase === "ended" ? newGame() : gameRef.current
    if (!game) return
    setStats(null)
    setFound([])
    setToasts([])
    setDropping(false)
    game.start()
    pause(false)
    lock()
  }

  const muted = mix.muted

  return (
    <div
      ref={wrapRef}
      className="@container relative h-full min-h-[360px] overflow-hidden bg-[#050304] text-[#f3e3c6] select-none"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        role="img"
        aria-label="The Infinity Castle: rooms of tatami and sliding doors hanging every which way in a bottomless void, lit by paper lanterns, rearranging themselves."
        onClick={() => playing && !paused && lock()}
      />

      {/* One stable element: touch listeners are bound to it once. */}
      <div ref={touchRef} className={cn("absolute inset-0 z-10 touch-none", !(touch && playing && !paused) && "hidden")} />

      {error && (
        <div className="absolute inset-0 z-30 grid place-items-center p-6 text-center">
          <p className={`${SERIF} max-w-sm text-lg`}>{error}</p>
        </div>
      )}

      {/* ── HUD (out of the way while you fall in) ───────────────────── */}
      {playing && !dropping && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 @md:p-4">
            <ul className="space-y-1" aria-label="Upper Moons found">
              {LANDMARKS.map((k) => {
                const done = found.includes(k)
                return (
                  <li key={k} className={cn("flex items-center gap-2 text-[0.6875rem] transition-colors", done ? "text-[#f3c77a]" : "text-[#f3e3c6]/40")}>
                    <span className={cn("grid size-4 place-items-center rounded-full border text-[0.5rem]", done ? "border-[#f3c77a] bg-[#f3c77a]/20" : "border-[#f3e3c6]/30")}>
                      {done ? "✓" : ""}
                    </span>
                    <span className="hidden @md:inline">{LANDMARK_NAMES[k].title}</span>
                    <span className={`${KANJI} @md:hidden`}>{LANDMARK_NAMES[k].rank.split("· ")[1]}</span>
                  </li>
                )
              })}
              <li className={cn("flex items-center gap-2 text-[0.6875rem]", found.length === 3 ? "text-[#ff8a5c]" : "text-[#f3e3c6]/25")}>
                <span className="grid size-4 place-items-center rounded-full border border-current text-[0.5rem]">◉</span>
                <span className="hidden @md:inline">{found.length === 3 ? "Reach Nakime" : "Nakime (sealed)"}</span>
                <span className={`${KANJI} @md:hidden`}>鳴女</span>
              </li>
            </ul>
            <div className="flex gap-2">
              <button type="button" className={chip} onClick={() => gameRef.current?.strum({ manual: true })} aria-label="Provoke the biwa (F)" title="Provoke the biwa (F)">
                <Music2 className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(chip, !mix.biwa && "text-[#f3e3c6]/40")}
                onClick={() => changeMix({ biwa: !mix.biwa })}
                aria-label={mix.biwa ? "Mute the biwa strums (B)" : "Unmute the biwa strums (B)"}
                aria-pressed={mix.biwa}
                title={mix.biwa ? "Mute the biwa strums (B)" : "Unmute the biwa strums (B)"}
              >
                <Guitar className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(chip, soundOpen && "border-[#e0a25a]/70")}
                onClick={() => setSoundOpen((o) => !o)}
                aria-label="Sound settings"
                aria-expanded={soundOpen}
                title="Sound settings"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className={chip}
                onClick={() => changeMix({ muted: !muted })}
                aria-label={muted ? "Sound on (M)" : "Sound off (M)"}
                title={muted ? "Sound on (M)" : "Sound off (M)"}
              >
                {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
              </button>
              <button
                type="button"
                className={chip}
                onClick={() => {
                  document.exitPointerLock?.()
                  pause(true)
                }}
                aria-label="Pause"
                title="Pause (Esc)"
              >
                <Pause className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {soundOpen && <SoundPanel mix={mix} onChange={changeMix} className="absolute top-14 right-3 z-20 @md:right-4" />}

          {/* Crosshair and Tanjiro's nose. */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="size-1 rounded-full bg-[#f3e3c6]/70" />
            <div ref={scentRef} className="absolute -top-[26px] -left-[26px] size-[56px] transition-opacity">
              <ArrowUp className="absolute top-0 left-1/2 size-3.5 -translate-x-1/2 text-[#ff9a62] drop-shadow-[0_0_6px_#ff6a2a]" aria-hidden />
            </div>
          </div>
          <p
            ref={scentLabelRef}
            className={`${SERIF} pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 text-sm whitespace-nowrap text-[#f3e3c6]/60 italic`}
            aria-live="off"
          />

          {!touch && (
            <p className="pointer-events-none absolute right-4 bottom-3 z-20 hidden text-[0.6875rem] tracking-wide text-[#f3e3c6]/35 @2xl:block">
              WASD walk · Shift run · Space jump · F biwa · B strums · N music · M mute · Esc pause
            </p>
          )}

          {touch && (
            <>
              {stick && (
                <div className="pointer-events-none absolute z-20" style={{ left: stick.x - 56, top: stick.y - 56 }}>
                  <div className="size-28 rounded-full border border-[#f3e3c6]/25 bg-black/20" />
                  <div
                    className="absolute size-12 rounded-full bg-[#f3e3c6]/30"
                    style={{ left: 56 - 24 + stick.dx, top: 56 - 24 + stick.dy }}
                  />
                </div>
              )}
              {!stick && (
                <p className="pointer-events-none absolute bottom-10 left-6 z-20 text-[0.6875rem] text-[#f3e3c6]/40">
                  Drag here to walk
                </p>
              )}
              <p className="pointer-events-none absolute right-6 bottom-10 z-20 text-right text-[0.6875rem] text-[#f3e3c6]/40">
                Drag to look · tap to jump
              </p>
            </>
          )}
        </>
      )}

      {/* Toasts. */}
      <div className="pointer-events-none absolute inset-x-0 top-[18%] z-20 flex flex-col items-center gap-2 px-4 text-center" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="animate-[ic-toast_4.6s_ease_both]">
            <p className={`${SERIF} text-xl font-medium text-[#f6dcae] drop-shadow-[0_2px_8px_#000] @md:text-2xl`}>{t.title}</p>
            {t.sub && <p className="mt-0.5 text-xs text-[#f3e3c6]/70 drop-shadow-[0_1px_4px_#000]">{t.sub}</p>}
          </div>
        ))}
      </div>

      {/* べべん — the biwa's twang, written into the frame, manga-style. */}
      {beben > 0 && playing && !reduced && (
        <p
          key={beben}
          aria-hidden
          className={`${KANJI} pointer-events-none absolute z-10 animate-[ic-beben_1.3s_ease-out_both] text-5xl font-bold text-[#ffe2b0]/80 [text-shadow:0_0_24px_#ff5a1a] @md:text-7xl`}
          style={{ left: `${12 + ((beben * 37) % 60)}%`, top: `${22 + ((beben * 23) % 40)}%`, writingMode: "vertical-rl" }}
        >
          べべん
        </p>
      )}

      {titlecard && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="animate-[ic-card_3.4s_ease_both] text-center">
            <p className={`${KANJI} text-6xl font-bold tracking-[0.2em] text-[#fff1d6] [text-shadow:0_0_40px_#ff6a2a] @md:text-8xl`}>無限城</p>
            <p className={`${SERIF} mt-2 text-sm tracking-[0.5em] text-[#f3e3c6]/80`}>INFINITY CASTLE</p>
          </div>
        </div>
      )}

      {/* ── Title ───────────────────────────────────────────────────── */}
      {phase === "title" && !error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,transparent_20%,#00000088_75%)] p-6 text-center">
          <p className={`${KANJI} text-5xl font-bold tracking-[0.25em] text-[#fff1d6] [text-shadow:0_0_36px_#ff5a1a] @md:text-7xl`}>無限城</p>
          <h2 className={`${SERIF} mt-2 text-sm tracking-[0.55em] text-[#f3e3c6]/85 @md:text-base`}>INFINITY CASTLE</h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-[#f3e3c6]/80 [text-shadow:0_1px_8px_#000]">
            A biwa sounds and the floor is gone. You fall into a castle of tatami rooms hanging every which way in
            a bottomless dark, crossed by long decks where whole buildings slide past like trains. Every building
            pulls toward its own floor, so walls become floors. Every few dozen steps Nakime strums and it
            rearranges itself. Follow the scent to the three Upper Moons&rsquo; rooms, then climb to her.
          </p>
          <button
            type="button"
            onClick={enter}
            className={`${SERIF} mt-6 rounded-full border border-[#e0a25a]/60 bg-[#5a1408]/50 px-7 py-2.5 text-lg tracking-[0.2em] text-[#fff1d6] shadow-[0_0_30px_#ff5a1a55] transition hover:bg-[#7a1c0a]/70 focus-visible:outline-2 focus-visible:outline-[#e0a25a]`}
          >
            Fall into the castle
          </button>
          <p className="mt-4 text-[0.6875rem] text-[#f3e3c6]/45">
            {touch
              ? "Left thumb walks · right thumb looks · tap to jump · sound on"
              : "WASD to walk · mouse to look · Shift run · Space jump · F biwa · B strums · M mute · sound on"}
          </p>
        </div>
      )}

      {/* ── Pause ───────────────────────────────────────────────────── */}
      {paused && playing && (
        <div
          onClick={() => {
            pause(false)
            lock()
          }}
          className="absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-5 bg-black/55 p-4 text-center backdrop-blur-[2px]"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              pause(false)
              lock()
            }}
            className="flex flex-col items-center focus-visible:outline-2 focus-visible:outline-[#e0a25a]"
          >
            <span className={`${KANJI} text-4xl text-[#fff1d6]/90`}>休</span>
            <span className={`${SERIF} mt-2 text-xl tracking-[0.2em]`}>Paused</span>
            <span className="mt-2 text-xs text-[#f3e3c6]/60">{touch ? "Tap to return" : "Click to return to the castle"}</span>
          </button>
          <SoundPanel mix={mix} onChange={changeMix} className="cursor-default" />
        </div>
      )}

      {/* ── The end ─────────────────────────────────────────────────── */}
      {phase === "ended" && stats && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#f6ead2]/10 p-6 text-center text-[#2a1408]">
          <p className={`${KANJI} text-4xl font-bold text-[#3b1206]`}>夜明け</p>
          <p className={`${SERIF} mt-1 text-2xl`}>The castle surfaces</p>
          <p className="mt-3 max-w-sm text-sm text-[#3b1206]/80">
            You reached Nakime. With her biwa silenced, the Infinity Castle is dragged up into the dawn.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm @md:grid-cols-5">
            {[
              ["Time", `${Math.floor(stats.seconds / 60)}:${String(Math.floor(stats.seconds % 60)).padStart(2, "0")}`],
              ["Walked", `${Math.round(stats.metres)} m`],
              ["Strums", stats.strums],
              ["Rooms", stats.rooms],
              ["Falls", stats.falls],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.6875rem] tracking-wide text-[#3b1206]/60 uppercase">{k}</dt>
                <dd className={`${SERIF} text-xl`}>{v}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={enter}
            className={`${SERIF} mt-6 rounded-full border border-[#3b1206]/50 px-6 py-2 text-lg tracking-[0.15em] transition hover:bg-[#3b1206]/10`}
          >
            Walk a new castle
          </button>
        </div>
      )}

      <style>{`
        @keyframes ic-toast { 0% { opacity: 0; transform: translateY(6px) } 10%, 80% { opacity: 1; transform: none } 100% { opacity: 0 } }
        @keyframes ic-beben { 0% { opacity: 0; transform: scale(1.6) } 12% { opacity: 1; transform: scale(1) } 70% { opacity: .9 } 100% { opacity: 0; transform: scale(.96) translateY(-8px) } }
        @keyframes ic-card { 0% { opacity: 0; letter-spacing: .6em; filter: blur(8px) } 25%, 70% { opacity: 1; letter-spacing: .2em; filter: none } 100% { opacity: 0; filter: blur(6px) } }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[ic-"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
