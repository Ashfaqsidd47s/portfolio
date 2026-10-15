import * as React from "react"
import { useReducedMotion } from "motion/react"
import { RotateCcw, Sparkles, X } from "lucide-react"
import "@fontsource/cormorant-garamond/latin-400-italic.css"
import "@fontsource/cormorant-garamond/latin-500.css"
import { cn } from "@/lib/utils"
import type { AppProps } from "@/os/registry/apps"
import { Scene } from "./scene"

const MAX_LENGTH = 40
const DEMO = "Berkeley"
const IDEAS = ["Forever", "Happy anniversary", "Will you marry me?"]

const chip =
  "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[#d9b46a]/25 bg-white/[0.04] px-3 py-1.5 text-xs text-[#f2e9d6]/85 backdrop-blur-sm transition-colors hover:border-[#d9b46a]/60 hover:bg-white/[0.08] hover:text-[#f2e9d6] focus-visible:outline-2 focus-visible:outline-[#d9b46a] disabled:pointer-events-none disabled:opacity-40"

/**
 * Berkeley Diamonds: a brand's loading intro, then a garden where every
 * letter typed grows a diamond on a gold stem. Inspired by type-garden,
 * where letters grow flowers.
 */
export default function BerkeleyDiamonds({ isPhone, isFocused, isVisible }: AppProps) {
  const reduced = useReducedMotion() ?? false
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const sceneRef = React.useRef<Scene | null>(null)
  const typer = React.useRef<number | null>(null)
  const touched = React.useRef(false)
  /** The brand name planted after the intro is on screen, untouched. */
  const demo = React.useRef(false)
  const [text, setText] = React.useState("")
  const [intro, setIntro] = React.useState(true)
  const [focused, setFocused] = React.useState(false)

  const stopTyping = () => {
    if (typer.current !== null) window.clearInterval(typer.current)
    typer.current = null
  }

  /** Types a phrase out a letter at a time, so each stone has room to grow. */
  const typeOut = React.useCallback((phrase: string) => {
    stopTyping()
    setText("")
    let i = 0
    typer.current = window.setInterval(() => {
      i++
      setText(phrase.slice(0, i))
      if (i >= phrase.length) stopTyping()
    }, 120)
  }, [])

  // One scene for the life of the window; the intro waits for its fonts.
  React.useEffect(() => {
    const canvas = canvasRef.current!
    const scene = new Scene(canvas, { reduced, onIntroEnd: () => setIntro(false) })
    scene.hint = isPhone ? "Tap here and start typing" : "Click here and start typing"
    sceneRef.current = scene
    let live = true
    const fonts = document.fonts
      ? Promise.race([
          Promise.all([fonts500(), fontsItalic()]),
          new Promise((r) => window.setTimeout(r, 900)),
        ])
      : Promise.resolve()
    void fonts.then(() => live && scene.startIntro())
    return () => {
      live = false
      stopTyping()
      sceneRef.current = null
    }
    // The scene is built once; `isPhone` and `reduced` don't change under a window.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const wrap = wrapRef.current!
    const fit = () => {
      const rect = wrap.getBoundingClientRect()
      sceneRef.current?.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // Draw only while the window can be seen.
  React.useEffect(() => {
    if (!isVisible) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      sceneRef.current?.frame((now - last) / 1000)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isVisible])

  React.useEffect(() => {
    sceneRef.current?.setText(text)
  }, [text])

  React.useEffect(() => {
    if (sceneRef.current) sceneRef.current.focused = focused
  }, [focused])

  // After the intro: take the keyboard (desktop only; a phone keyboard would
  // cover the garden) and, if nobody has typed yet, plant the brand's name.
  React.useEffect(() => {
    if (intro) return
    if (isFocused && !isPhone) inputRef.current?.focus({ preventScroll: true })
    if (touched.current) return
    const id = window.setTimeout(() => {
      if (touched.current) return
      demo.current = true
      typeOut(DEMO)
    }, reduced ? 0 : 450)
    return () => window.clearTimeout(id)
    // Runs once, when the intro ends.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [intro])

  const replay = () => {
    stopTyping()
    touched.current = false
    demo.current = false
    setText("")
    setIntro(true)
    sceneRef.current?.startIntro()
  }

  const keepCaretAtEnd = (el: HTMLInputElement) => {
    const end = el.value.length
    if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end)
  }

  return (
    <div ref={wrapRef} className="relative h-full min-h-[360px] overflow-hidden bg-[#07080d] text-[#f2e9d6] select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        role="img"
        aria-label="Berkeley Diamonds: every letter you type grows a faceted diamond on a gold stem."
      />

      <input
        ref={inputRef}
        value={text}
        maxLength={MAX_LENGTH}
        aria-label="Type to grow diamonds"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        disabled={intro}
        className="absolute inset-0 size-full cursor-text opacity-0 text-base"
        onFocus={(e) => {
          setFocused(true)
          keepCaretAtEnd(e.currentTarget)
        }}
        onBlur={() => setFocused(false)}
        onSelect={(e) => keepCaretAtEnd(e.currentTarget)}
        onChange={(e) => {
          let value = e.target.value
          // The first key pressed over the planted demo starts a fresh garden.
          if (demo.current && !touched.current && value.length > text.length && value.startsWith(text)) {
            value = value.slice(text.length)
          }
          touched.current = true
          demo.current = false
          stopTyping()
          setText(value.slice(0, MAX_LENGTH))
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            sceneRef.current?.sparkle()
          }
        }}
      />

      {!intro && !isPhone && (
        <p className="pointer-events-none absolute bottom-3 right-4 z-10 hidden text-[0.6875rem] tracking-wide text-[#f2e9d6]/40 sm:block">
          Type to plant · Backspace to wilt · Enter to sparkle
        </p>
      )}

      {intro ? (
        !reduced && (
          <button
            type="button"
            onClick={() => sceneRef.current?.skipIntro()}
            className={cn(chip, "absolute bottom-4 right-4 z-10")}
          >
            Skip intro
          </button>
        )
      ) : (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4">
          <p className="font-['Cormorant_Garamond',Georgia,serif] text-sm font-medium tracking-[0.32em] text-[#e9cf8f]">
            BERKELEY <span className="text-[#f2e9d6]/60">DIAMONDS</span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                className={cn(chip, "hidden sm:inline-flex")}
                onClick={() => {
                  touched.current = true
                  typeOut(idea)
                  inputRef.current?.focus({ preventScroll: true })
                }}
              >
                {idea}
              </button>
            ))}
            <button
              type="button"
              className={chip}
              onClick={() => sceneRef.current?.sparkle()}
              aria-label="Make the diamonds sparkle (Enter)"
              title="Sparkle (Enter)"
            >
              <Sparkles className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={chip}
              disabled={!text}
              onClick={() => {
                touched.current = true
                stopTyping()
                setText("")
                inputRef.current?.focus({ preventScroll: true })
              }}
              aria-label="Clear"
              title="Clear"
            >
              <X className="size-3.5" aria-hidden />
            </button>
            <button type="button" className={chip} onClick={replay} aria-label="Replay the intro" title="Replay the intro">
              <RotateCcw className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const fonts500 = () => document.fonts.load(`500 64px "Cormorant Garamond"`)
const fontsItalic = () => document.fonts.load(`italic 400 40px "Cormorant Garamond"`)
