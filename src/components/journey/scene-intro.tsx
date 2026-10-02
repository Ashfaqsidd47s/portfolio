import * as React from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react"
import { profile } from "@/data/profile"
import { cn } from "@/lib/utils"
import { PixelSprite } from "./primitives"
import { ramp, useSteppedValue } from "./hooks"
import { STAR } from "./sprites"

/* A tiny CSS-3D toolkit: boxes positioned around an origin at the rig's centre. */

type Faces = Partial<Record<"front" | "back" | "left" | "right" | "top" | "bottom", React.ReactNode>>

function Box({
  w,
  h,
  d,
  x = 0,
  y = 0,
  z = 0,
  color,
  faces = {},
  className,
  style,
}: {
  w: number
  h: number
  d: number
  x?: number
  y?: number
  z?: number
  /** Base colours for front / side / top faces. */
  color: { front: string; side: string; top: string }
  faces?: Faces
  className?: string
  style?: React.ComponentProps<typeof motion.div>["style"]
}) {
  const face = "absolute left-0 top-0 border-[3px] border-[#1b1430] backface-hidden"
  const sides: Array<{
    key: keyof Faces
    width: number
    height: number
    transform: string
    bg: string
  }> = [
    { key: "front", width: w, height: h, transform: `translateZ(${d / 2}px)`, bg: color.front },
    { key: "back", width: w, height: h, transform: `rotateY(180deg) translateZ(${d / 2}px)`, bg: color.side },
    { key: "left", width: d, height: h, transform: `rotateY(-90deg) translateZ(${w / 2}px)`, bg: color.side },
    { key: "right", width: d, height: h, transform: `rotateY(90deg) translateZ(${w / 2}px)`, bg: color.side },
    { key: "top", width: w, height: d, transform: `rotateX(90deg) translateZ(${h / 2}px)`, bg: color.top },
    { key: "bottom", width: w, height: d, transform: `rotateX(-90deg) translateZ(${h / 2}px)`, bg: color.side },
  ]
  return (
    <motion.div
      className={cn("preserve-3d absolute left-0 top-0", className)}
      style={{ x, y, z, ...style }}
    >
      {sides.map((s) => (
        <div
          key={s.key}
          className={face}
          style={{
            width: s.width,
            height: s.height,
            marginLeft: -s.width / 2,
            marginTop: -s.height / 2,
            transform: s.transform,
            background: s.bg,
          }}
        >
          {faces[s.key]}
        </div>
      ))}
    </motion.div>
  )
}

/* Monitor geometry (px). The screen's centre is the zoom target. */
const MW = 340
const MH = 280
const MD = 250
const SCREEN = { left: 24, top: 22, w: MW - 48, h: MH - 22 - 66 }
const SCREEN_CY = -MH / 2 + SCREEN.top + SCREEN.h / 2
const DESK_Y = MH / 2 + 26

const BOOT_LINES = [
  "C:\\>cd TC",
  "C:\\TC>TC.EXE",
  "Loading Turbo C++ 3.0 ...",
]

function ScreenContent({ progress }: { progress: MotionValue<number> }) {
  const p = useSteppedValue(progress, 60)
  // Type the boot commands out as the camera swings round.
  const typed = Math.max(0, Math.min(1, (p - 0.08) / 0.45))
  const budget = Math.floor(typed * BOOT_LINES.join("").length)
  const starts = BOOT_LINES.map((_, i) => BOOT_LINES.slice(0, i).join("").length)
  const lines = BOOT_LINES.map((l, i) => l.slice(0, Math.max(0, budget - starts[i]))).filter(
    (l, i) => l.length > 0 || i === 0
  )

  return (
    <div className="crt absolute overflow-hidden bg-[#050a08] font-terminal text-[15px] leading-tight text-tc-green shadow-[inset_0_0_30px_rgb(77_255_136/0.25)]"
      style={{ left: SCREEN.left, top: SCREEN.top, width: SCREEN.w, height: SCREEN.h }}
    >
      <div className="animate-flicker p-3">
        <p className="text-tc-gray">MS-DOS Version 6.22</p>
        <p className="mb-2 text-tc-gray">(C)Copyright 1981-1994</p>
        {lines.map((l, i) => (
          <p key={i}>
            {l}
            {i === lines.length - 1 && <span className="animate-blink">█</span>}
          </p>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(255_255_255/0.12),transparent_55%)]" />
    </div>
  )
}

function MonitorFront({ progress }: { progress: MotionValue<number> }) {
  return (
    <>
      {/* Bezel bevel */}
      <div className="absolute inset-2 border-[3px] border-[#bfb49b] border-r-[#f3ead6] border-t-[#f3ead6]" />
      <div
        className="absolute bg-[#2a2440]"
        style={{ left: SCREEN.left - 6, top: SCREEN.top - 6, width: SCREEN.w + 12, height: SCREEN.h + 12 }}
      />
      <ScreenContent progress={progress} />
      <div className="absolute inset-x-6 bottom-5 flex items-center justify-between">
        <span className="retro text-[8px] text-[#6b6150]">ASH·486</span>
        <span className="flex items-center gap-2">
          <span className="block h-2 w-8 bg-[repeating-linear-gradient(90deg,#8a7f68_0_2px,transparent_2px_4px)]" />
          <span className="animate-blink block size-2 bg-px-green shadow-[0_0_6px_#4dff88]" />
        </span>
      </div>
    </>
  )
}

function KeyboardTop() {
  return (
    <div className="grid h-full grid-cols-[repeat(15,1fr)] grid-rows-5 gap-[3px] p-2">
      {Array.from({ length: 75 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "block bg-[#efe6d2] shadow-[inset_-2px_-2px_0_#b8ad94]",
            // Space bar
            i === 66 && "col-span-6",
            i > 66 && i < 72 && "hidden"
          )}
        />
      ))}
    </div>
  )
}

function Rig({ progress }: { progress: MotionValue<number> }) {
  const rotateX = useTransform(progress, [0, 0.42], [-16, 0])
  const rotateY = useTransform(progress, [0, 0.42], [-30, 0])
  const scale = useTransform(progress, [0.42, 0.68, 0.9], [1, 2.2, 13])
  const propsOpacity = useTransform(progress, (v) => ramp(v, [0.45, 0.6], [1, 0]))
  const propsVisibility = useTransform(propsOpacity, (o) => (o <= 0.01 ? "hidden" : "visible"))

  return (
    <div className="preserve-3d scale-[0.62] sm:scale-[0.85] lg:scale-100">
      <motion.div
        className="preserve-3d relative size-0"
        style={{
          rotateX,
          rotateY,
          scale,
          transformOrigin: `0px ${SCREEN_CY}px ${MD / 2}px`,
        }}
      >
        {/* Desk */}
        <motion.div
          className="preserve-3d absolute left-0 top-0"
          style={{ opacity: propsOpacity, visibility: propsVisibility }}
        >
          <div
            className="absolute left-0 top-0 border-t-[6px] border-[#3a2418]"
            style={{
              width: 1500,
              height: 820,
              marginLeft: -750,
              marginTop: -410,
              transform: `translateY(${DESK_Y}px) rotateX(90deg)`,
              background:
                "repeating-linear-gradient(90deg, #6b3f26 0 118px, #5a331f 118px 122px), #6b3f26",
              boxShadow: "inset 0 0 160px rgb(0 0 0 / 0.65)",
            }}
          />
          {/* Keyboard */}
          <Box
            w={330}
            h={18}
            d={112}
            y={DESK_Y - 9}
            z={MD / 2 + 112}
            color={{ front: "#cfc4ab", side: "#b8ad94", top: "#d9cfb8" }}
            faces={{ top: <KeyboardTop /> }}
          />
          {/* Floppy disk */}
          <div
            className="absolute left-0 top-0"
            style={{
              width: 64,
              height: 68,
              marginLeft: -32,
              marginTop: -34,
              transform: `translate3d(250px, ${DESK_Y - 1}px, ${MD / 2 + 70}px) rotateX(90deg) rotateZ(-14deg)`,
            }}
          >
            <div className="relative size-full border-[3px] border-[#1b1430] bg-px-purple">
              <div className="absolute inset-x-3 top-0 h-5 bg-[#c8c8d0]" />
              <div className="absolute inset-x-2 bottom-2 h-7 bg-cream" />
            </div>
          </div>
          {/* Mug */}
          <Box
            w={34}
            h={42}
            d={34}
            x={-245}
            y={DESK_Y - 21}
            z={MD / 2 + 40}
            color={{ front: "#ff4d8d", side: "#c2306a", top: "#2b1810" }}
          />
          {/* Monitor stand */}
          <Box
            w={150}
            h={26}
            d={130}
            y={MH / 2 + 13}
            color={{ front: "#cfc4ab", side: "#b0a58c", top: "#d9cfb8" }}
          />
        </motion.div>

        {/* Monitor */}
        <Box
          w={MW}
          h={MH}
          d={MD}
          color={{ front: "#e2d8c2", side: "#c7bca4", top: "#ece3cf" }}
          faces={{
            front: <MonitorFront progress={progress} />,
            top: (
              <div className="absolute inset-6 bg-[repeating-linear-gradient(90deg,#b8ad94_0_4px,transparent_4px_10px)] opacity-70" />
            ),
          }}
        />
      </motion.div>
    </div>
  )
}

function Room() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,#2b2466_0%,#16123a_45%,#0b0a1f_80%)]" />
      {/* Night window */}
      <div className="absolute left-[6%] top-[14%] hidden h-56 w-44 border-[6px] border-[#2a2440] bg-[#0d1640] md:block">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-[#2a2440]" />
        <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-[#2a2440]" />
        <div className="absolute right-4 top-4 size-10 bg-cream shadow-[0_0_30px_#f6eedd]" style={{ clipPath: "polygon(25% 0,75% 0,100% 25%,100% 75%,75% 100%,25% 100%,0 75%,0 25%)" }} />
        {[[14, 20], [30, 70], [60, 40], [75, 80], [20, 85]].map(([l, t], i) => (
          <span
            key={i}
            className="animate-twinkle absolute size-1 bg-cream"
            style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.5}s` }}
          />
        ))}
      </div>
      {/* Poster */}
      <div className="absolute right-[7%] top-[16%] hidden rotate-3 border-4 border-[#2a2440] bg-px-yellow p-3 md:block">
        <p className="retro text-[0.5rem] leading-relaxed text-night">
          CLASS XI
          <br />
          COMPUTER
          <br />
          SCIENCE
        </p>
        <p className="retro mt-2 text-lg text-tc-blue">2018</p>
      </div>
      {/* Desk-lamp glow */}
      <div className="absolute left-1/2 top-[60%] size-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_210_63/0.10),transparent_60%)]" />
    </div>
  )
}

export function SceneIntro() {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const still = useMotionValue(0)
  const progress = reduced ? still : scrollYProgress

  const titleOpacity = useTransform(progress, (v) => ramp(v, [0, 0.14], [1, 0]))
  const titleY = useTransform(progress, [0, 0.14], [0, -40])
  const blue = useTransform(progress, (v) => ramp(v, [0.8, 0.93], [0, 1]))
  const blueVisibility = useTransform(blue, (o) => (o <= 0.01 ? "hidden" : "visible"))

  return (
    <section
      id="top"
      ref={ref}
      aria-label="Intro"
      className={reduced ? "relative h-svh" : "relative h-[300vh]"}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        <Room />

        <div className="absolute inset-0 grid place-items-center [perspective-origin:50%_42%] [perspective:1100px]">
          <div className="preserve-3d translate-y-[4vh]">
            <Rig progress={progress} />
          </div>
        </div>

        <motion.div
          className="absolute inset-x-0 top-[13%] z-10 flex flex-col items-center px-4 text-center sm:top-[15%]"
          style={{ opacity: titleOpacity, y: titleY }}
        >
          <p className="retro text-[0.5625rem] tracking-[0.25em] text-px-cyan sm:text-[0.6875rem]">
            A SCROLL ADVENTURE
          </p>
          <h1 className="retro pixel-text-shadow mt-4 text-[clamp(1.35rem,5.4vw,3.4rem)] leading-tight text-cream">
            {profile.name}
          </h1>
          <p className="mt-3 font-pixel-sans text-lg text-lilac sm:text-2xl">
            {profile.role} · from <span className="text-tc-green">Hello World</span> to shipping
            products
          </p>
          <div className="pointer-events-none absolute -left-2 top-0 hidden w-6 animate-bob sm:block">
            <PixelSprite sprite={STAR} />
          </div>
        </motion.div>

        <motion.p
          className="retro absolute inset-x-0 bottom-8 z-10 text-center text-[0.5625rem] text-px-yellow sm:text-[0.625rem]"
          style={{ opacity: titleOpacity }}
        >
          {reduced ? "SCROLL TO BEGIN ▼" : <span className="animate-blink">▼ SCROLL TO BOOT ▼</span>}
        </motion.p>

        {/* The camera dives into the screen and lands in the Turbo C++ blue. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 z-20 grid place-items-center bg-tc-blue"
          style={{ opacity: blue, visibility: blueVisibility }}
        >
          <p className="font-terminal text-3xl text-tc-yellow">Turbo C++ IDE</p>
        </motion.div>
      </div>
    </section>
  )
}
