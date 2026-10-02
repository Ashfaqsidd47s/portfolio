import * as React from "react"
import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react"
import { useSay } from "./companion-context"
import { ramp, useSceneProgress, useSteppedValue } from "./hooks"
import { Box } from "./scene-intro"

/**
 * The hardware upgrade between the Turbo C++ era and the Android era.
 * Camera pulls back out of the CRT, the CRT powers off and drops away, the
 * year ticks over, a 2020 laptop rises in, opens, boots the IDE, and the
 * camera dives into its screen, landing in the IDE's own background colour.
 */

const IDE_BG = "#2b2b2b"

/* Laptop geometry (px), anchored at the centre of the base. */
const BASE = { w: 380, h: 12, d: 250 }
const LID = { w: 360, h: 232 }
const LID_OPEN = 6 // degrees; slightly reclined
const LID_PIVOT = { y: -BASE.h / 2, z: -BASE.d / 2 + 4 }
const rad = (LID_OPEN * Math.PI) / 180
/** Lid screen centre in rig space at the open angle — the zoom target. */
const SCREEN_CENTRE = {
  y: LID_PIVOT.y - (LID.h / 2) * Math.cos(rad),
  z: LID_PIVOT.z - (LID.h / 2) * Math.sin(rad),
}

function StudioSplash({ progress }: { progress: MotionValue<number> }) {
  const load = useTransform(progress, (v) => `${ramp(v, [0.58, 0.78], [4, 100])}%`)
  return (
    <div className="absolute inset-2.5 overflow-hidden rounded-[6px] bg-[#1e1f22] font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#3a4d3f,transparent_60%)]" />
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#3ddc84] to-[#1a7f4b] text-sm font-bold text-[#0d2b1a]">
            {"</>"}
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight text-white">Android Studio</p>
            <p className="text-[10px] text-white/50">4.1 · 2020</p>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] text-white/60">Loading project TicTacToe…</p>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-[#3ddc84]" style={{ width: load }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Laptop({ progress }: { progress: MotionValue<number> }) {
  const lid = useTransform(progress, (v) => ramp(v, [0.5, 0.66], [-88, LID_OPEN]))
  const rise = useTransform(progress, (v) => ramp(v, [0.42, 0.54], [520, 0]))
  const tilt = useTransform(progress, (v) => ramp(v, [0.5, 0.72], [-22, 0]))
  const spin = useTransform(progress, (v) => ramp(v, [0.46, 0.72], [-24, 0]))
  const zoom = useTransform(progress, (v) =>
    v < 0.74 ? 1 : v < 0.84 ? 1 + ((v - 0.74) / 0.1) * 1.4 : 2.4 + ((Math.min(v, 0.96) - 0.84) / 0.12) * 12
  )

  return (
    <motion.div className="preserve-3d" style={{ y: rise }}>
      <div className="preserve-3d scale-[0.6] sm:scale-[0.85] lg:scale-100">
        <motion.div
          className="preserve-3d relative size-0"
          style={{
            rotateX: tilt,
            rotateY: spin,
            scale: zoom,
            transformOrigin: `0px ${SCREEN_CENTRE.y}px ${SCREEN_CENTRE.z}px`,
          }}
        >
          {/* Base with keyboard deck */}
          <Box
            w={BASE.w}
            h={BASE.h}
            d={BASE.d}
            faceClassName="rounded-[3px]"
            color={{ front: "#9ea3aa", side: "#8c9198", top: "#c9cdd2" }}
            faces={{
              top: (
                <div className="flex h-full flex-col items-center gap-3 px-6 pb-4 pt-6">
                  <div className="grid w-full flex-1 grid-cols-[repeat(14,1fr)] gap-[3px] rounded-[3px] bg-[#2a2c30] p-1.5">
                    {Array.from({ length: 56 }).map((_, i) => (
                      <span key={i} className="rounded-[2px] bg-[#3a3d42]" />
                    ))}
                  </div>
                  <div className="h-16 w-36 rounded-[4px] bg-[#b9bdc2] shadow-[inset_0_0_0_1px_#a7abb1]" />
                </div>
              ),
            }}
          />
          {/* Lid, hinged at the back edge of the base */}
          <motion.div
            className="preserve-3d absolute left-0 top-0"
            style={{
              width: LID.w,
              height: LID.h,
              marginLeft: -LID.w / 2,
              marginTop: -LID.h,
              x: 0,
              y: LID_PIVOT.y,
              z: LID_PIVOT.z,
              rotateX: lid,
              transformOrigin: "50% 100%",
            }}
          >
            <div className="backface-hidden absolute inset-0 rounded-[10px] bg-[#16171a] shadow-[inset_0_0_0_2px_#2b2d31]">
              <StudioSplash progress={progress} />
            </div>
            <div
              className="backface-hidden absolute inset-0 grid place-items-center rounded-[10px] bg-gradient-to-br from-[#d3d6da] to-[#a9adb3]"
              style={{ transform: "rotateY(180deg)" }}
            >
              <span className="size-8 rounded-full bg-white/40" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}

function Crt({ progress }: { progress: MotionValue<number> }) {
  // Pull back out of the screen, power off, drop away.
  const scale = useTransform(progress, (v) => ramp(v, [0, 0.2], [5.5, 1]))
  const screenY = useTransform(progress, (v) => ramp(v, [0.24, 0.29], [1, 0.012]))
  const screenX = useTransform(progress, (v) => ramp(v, [0.29, 0.33], [1, 0]))
  // The classic CRT switch-off: a bright line that shrinks to a dot.
  const line = useTransform(progress, (v) => (v > 0.27 && v < 0.335 ? 1 : 0))
  const lineX = useTransform(progress, (v) => ramp(v, [0.29, 0.33], [1, 0.02]))
  const drop = useTransform(progress, (v) => ramp(v, [0.34, 0.46], [0, 900]))
  const tip = useTransform(progress, (v) => ramp(v, [0.34, 0.46], [0, 14]))

  return (
    <motion.div style={{ y: drop, rotate: tip }}>
      <motion.div
        className="relative h-[15rem] w-[18rem] border-[4px] border-[#1b1430] bg-[#e2d8c2] p-5 pb-12 shadow-[10px_12px_0_rgb(0_0_0/0.45)] sm:h-[17.5rem] sm:w-[21rem]"
        style={{ scale }}
      >
        <div className="relative h-full overflow-hidden bg-black">
          <motion.div
            className="crt absolute inset-0 bg-black p-3 font-terminal text-lg leading-tight text-tc-green"
            style={{ scaleY: screenY, scaleX: screenX }}
          >
            <p className="text-tc-yellow">SCORE 0420 · GAME OVER</p>
            <div className="mt-3 flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="size-3 bg-tc-green" />
              ))}
              <span className="ml-6 size-3 bg-tc-red" />
            </div>
            <p className="mt-4 text-tc-gray">C:\TC&gt;exit</p>
            <p className="text-tc-gray">
              C:\&gt;<span className="animate-blink">_</span>
            </p>
          </motion.div>
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-white shadow-[0_0_14px_4px_rgb(255_255_255/0.7)]"
            style={{ opacity: line, scaleX: lineX }}
          />
        </div>
        <span className="retro absolute bottom-3 left-5 text-[8px] text-[#6b6150]">ASH·486</span>
        <span className="absolute bottom-4 right-5 size-2 bg-px-green" />
      </motion.div>
    </motion.div>
  )
}

const LINES = [
  { at: 0.12, text: "Turbo C++ era: cleared. Loot: one love calculator, one snake game." },
  { at: 0.4, text: "2020. New laptop. Graphics upgrade: 8-bit → actual pixels." },
  { at: 0.62, text: "Booting Android Studio. This may take a while. It always does." },
]

export function EraShift() {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const progress = useSceneProgress(ref)
  const p = useSteppedValue(progress, 100)
  const say = useSay()
  // Only while the scene is actually on screen, and once per line.
  const line = p > 0 && p < 0.98 ? [...LINES].reverse().find((l) => p >= l.at) : undefined

  React.useEffect(() => {
    if (line) say({ speaker: "ASHFAQ · 2019 → 2020", text: line.text, tone: "green" })
  }, [line, say])

  const nightOpacity = useTransform(progress, (v) => ramp(v, [0.4, 0.58], [1, 0]))
  const blackOpacity = useTransform(progress, (v) => ramp(v, [0, 0.05], [1, 0]))
  const endOpacity = useTransform(progress, (v) => ramp(v, [0.82, 0.92], [0, 1]))
  const cleared = useTransform(progress, (v) => (v > 0.3 && v < 0.44 ? 1 : 0))
  const yearOld = useTransform(progress, (v) => ramp(v, [0.3, 0.35], [0, 1]) * ramp(v, [0.39, 0.42], [1, 0]))
  const yearNew = useTransform(progress, (v) => ramp(v, [0.42, 0.47], [0, 1]) * ramp(v, [0.52, 0.57], [1, 0]))
  const yearShift = useTransform(progress, (v) => ramp(v, [0.38, 0.48], [0, -40]))

  if (reduced) return null

  return (
    <div ref={ref} className="relative h-[320vh]" aria-hidden>
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Modern room underneath, revealed as the pixel night fades */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,#3a3d43_0%,#25272b_45%,#1a1b1e_85%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-[#2e2f33] to-[#1f2023]" />
        <motion.div className="absolute inset-0 bg-night" style={{ opacity: nightOpacity }}>
          {[[12, 18], [28, 64], [70, 22], [84, 58], [46, 12], [58, 80], [8, 76]].map(([l, t], i) => (
            <span
              key={i}
              className="animate-twinkle absolute size-1.5 bg-cream"
              style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </motion.div>

        <div className="absolute inset-0 grid place-items-center">
          <Crt progress={progress} />
        </div>

        <motion.p
          className="retro pixel-text-shadow absolute inset-x-0 top-[22%] text-center text-[clamp(0.8rem,2.6vw,1.25rem)] text-px-yellow"
          style={{ opacity: cleared }}
        >
          TURBO C++ ERA · CLEARED
        </motion.p>

        <div className="absolute inset-x-0 top-[34%] text-center">
          <motion.p
            className="retro pixel-text-shadow text-[clamp(2.5rem,10vw,6rem)] text-cream"
            style={{ opacity: yearOld, y: yearShift }}
          >
            2019
          </motion.p>
          <motion.p
            className="absolute inset-x-0 top-0 font-sans text-[clamp(2.5rem,10vw,6rem)] font-semibold tracking-tight text-white"
            style={{ opacity: yearNew, y: yearShift }}
          >
            2020
          </motion.p>
        </div>

        <div className="absolute inset-0 grid place-items-center [perspective-origin:50%_40%] [perspective:1200px]">
          <div className="preserve-3d translate-y-[10vh]">
            <Laptop progress={progress} />
          </div>
        </div>

        <motion.div className="absolute inset-0 bg-black" style={{ opacity: blackOpacity }} />
        <motion.div className="absolute inset-0" style={{ opacity: endOpacity, background: IDE_BG }} />
      </div>
    </div>
  )
}
