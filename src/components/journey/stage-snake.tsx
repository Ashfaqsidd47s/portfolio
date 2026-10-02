import * as React from "react"
import { useInView } from "motion/react"
import { Button } from "@/components/ui/8bit/button"
import { Kbd } from "@/components/ui/8bit/kbd"
import { Dialogue, Stage, StageTitle, Sfx } from "./primitives"

const COLS = 24
const ROWS = 16
const TICK_MS = 115
const BEST_KEY = "portfolio-snake-best"

type Pt = { x: number; y: number }
type Dir = "up" | "down" | "left" | "right"
const DELTA: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" }
const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}
function writeBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n))
  } catch {
    /* storage unavailable — the high score just won't persist */
  }
}

function randomFood(snake: Pt[]): Pt {
  for (;;) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p
  }
}

const START: Pt[] = [
  { x: 6, y: 8 },
  { x: 5, y: 8 },
  { x: 4, y: 8 },
]

function SnakeGame() {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const inView = useInView(wrapRef, { amount: 0.4 })
  const [status, setStatus] = React.useState<"ready" | "playing" | "over">("ready")
  const [score, setScore] = React.useState(0)
  const [best, setBest] = React.useState(readBest)
  const game = React.useRef({
    snake: START,
    dir: "right" as Dir,
    queue: [] as Dir[],
    food: { x: 15, y: 8 } as Pt,
  })

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const cell = canvas.width / COLS
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Faint BGI grid
    ctx.fillStyle = "#0b1a0b"
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell)
    const { snake, food } = game.current
    ctx.fillStyle = "#ff5555"
    ctx.fillRect(food.x * cell + cell * 0.15, food.y * cell + cell * 0.15, cell * 0.7, cell * 0.7)
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#ffff55" : i % 2 ? "#55ff55" : "#3ccf3c"
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2)
    })
  }, [])

  // Size the canvas to its box, at device resolution.
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const w = canvas.clientWidth
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cell = Math.max(4, Math.floor((w * dpr) / COLS))
      canvas.width = cell * COLS
      canvas.height = cell * ROWS
      draw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  const start = React.useCallback(() => {
    game.current = { snake: START, dir: "right", queue: [], food: randomFood(START) }
    setScore(0)
    setStatus("playing")
    wrapRef.current?.focus({ preventScroll: true })
  }, [])

  const turn = React.useCallback((d: Dir) => {
    const g = game.current
    const last = g.queue[g.queue.length - 1] ?? g.dir
    if (d !== last && d !== OPPOSITE[last] && g.queue.length < 3) g.queue.push(d)
  }, [])

  // Game loop — only while playing and on screen.
  React.useEffect(() => {
    if (status !== "playing" || !inView) return
    const id = window.setInterval(() => {
      const g = game.current
      g.dir = g.queue.shift() ?? g.dir
      const head = g.snake[0]
      const next = { x: head.x + DELTA[g.dir].x, y: head.y + DELTA[g.dir].y }
      const hitWall = next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS
      const hitSelf = g.snake.some((s) => s.x === next.x && s.y === next.y)
      if (hitWall || hitSelf) {
        setStatus("over")
        setScore((s) => {
          if (s > readBest()) {
            writeBest(s)
            setBest(s)
          }
          return s
        })
        return
      }
      const ate = next.x === g.food.x && next.y === g.food.y
      g.snake = [next, ...(ate ? g.snake : g.snake.slice(0, -1))]
      if (ate) {
        g.food = randomFood(g.snake)
        setScore((s) => s + 10)
      }
      draw()
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [status, inView, draw])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]
    if (status === "playing" && d) {
      e.preventDefault()
      turn(d)
    } else if (status !== "playing" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      start()
    }
  }

  // Swipe to steer on touch screens.
  const touch = React.useRef<Pt | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current || status !== "playing") return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up")
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <p className="mb-2 font-terminal text-lg text-tc-gray">
        initgraph(&amp;gd, &amp;gm, <span className="text-[#55ffff]">"C:\\TC\\BGI"</span>);
      </p>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="application"
        aria-label="Snake game. Press Enter to start, arrow keys or WASD to steer."
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="crt relative border-4 border-tc-white bg-black outline-none focus-visible:border-px-yellow"
      >
        <canvas ref={canvasRef} className="pixelated block aspect-[3/2] w-full" />
        <div className="absolute left-3 top-2 z-10 flex gap-6 font-terminal text-xl text-tc-white">
          <span>SCORE {String(score).padStart(4, "0")}</span>
          <span className="text-tc-gray">HI {String(best).padStart(4, "0")}</span>
        </div>
        {status !== "playing" && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/60">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="retro text-sm text-tc-yellow sm:text-base">
                {status === "over" ? "GAME OVER" : "SNAKE.EXE"}
              </p>
              <Button
                size="sm"
                onClick={start}
                className="bg-tc-green text-[0.625rem] text-black hover:bg-tc-green/90"
              >
                {status === "over" ? "PLAY AGAIN" : "PRESS START"}
              </Button>
              <p className="hidden items-center gap-1.5 font-terminal text-lg text-tc-gray sm:flex">
                <Kbd>←</Kbd>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <Kbd>→</Kbd> or <Kbd>WASD</Kbd> to steer
              </p>
              <p className="font-terminal text-lg text-tc-gray sm:hidden">Swipe or use the pad</p>
            </div>
          </div>
        )}
      </div>

      {/* D-pad for touch */}
      <div className="mt-6 grid grid-cols-[repeat(3,3.25rem)] justify-center gap-2 sm:hidden">
        {(
          [
            ["", "up", ""],
            ["left", "", "right"],
            ["", "down", ""],
          ] as const
        )
          .flat()
          .map((d, i) =>
            d ? (
              <Button
                key={i}
                size="icon"
                aria-label={`Steer ${d}`}
                className="size-12 bg-ink-2 text-cream"
                onClick={() => (status === "playing" ? turn(d) : start())}
              >
                {{ up: "▲", down: "▼", left: "◀", right: "▶" }[d]}
              </Button>
            ) : (
              <span key={i} />
            )
          )}
      </div>
    </div>
  )
}

export function StageSnake() {
  return (
    <Stage id="snake" className="overflow-clip bg-black pb-28">
      <StageTitle
        id="snake"
        kicker="Then I found the graphics library, and printing text stopped being enough."
      />
      <div className="relative">
        <Sfx className="-top-10 right-[8%] hidden text-7xl text-tc-green md:block">ゴゴゴ</Sfx>
        <Dialogue speaker="ASHFAQ · 2019" tone="green" className="mb-12 px-4">
          No internet, no tutorials, no Stack Overflow. Just graphics.h, a lot of trial and error, and a snake that kept eating itself. I built the whole game myself, and it was great. Here it is again, rebuilt for the browser. Have a go.
        </Dialogue>
      </div>
      <SnakeGame />
    </Stage>
  )
}
