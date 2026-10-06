import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import { AiListing } from "@/apps/trypnow/ai-listing"
import { money } from "@/apps/trypnow/data"
import { PackageBuilder } from "@/apps/trypnow/package-builder"
import { AppWindow, DemoNote } from "./app-window"

// The builder and the AI listing are shared with the TrypNow app on the
// desktop, so a package published here shows up there too.

/* ---------------------------------- app ----------------------------------- */

export function TrypNowApp() {
  const [tab, setTab] = React.useState<"packages" | "ai">("packages")
  const [toast, setToast] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  return (
    <>
      <AppWindow
        name="trypnow"
        url={tab === "packages" ? "trypnow.com/supplier/packages/new" : "trypnow.com/supplier/attractions/new"}
        liveUrl="https://trypnow.com"
        accent="#5eead4"
        command="npm run dev"
        bootLines={["loading 30+ data tables … ok", "next.js ready on :3000"]}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#e3ecea] bg-white px-4 py-3">
          <p className="text-lg font-black tracking-tight text-[#0f3b38]">
            tryp<span className="text-[#0f766e]">now</span>{" "}
            <span className="ml-1 bg-[#e3f3f0] px-1.5 py-0.5 text-[0.625rem] font-bold text-[#0f766e]">DMC</span>
          </p>
          <div className="flex border-2 border-[#0f3b38] text-xs font-bold" role="group" aria-label="Feature">
            {(
              [
                ["packages", "Package builder"],
                ["ai", "AI listing"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                onClick={() => setTab(k)}
                className={cn("px-3 py-1.5", tab === k ? "bg-[#0f3b38] text-white" : "text-[#0f3b38]")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="@container">
          {tab === "packages" ? (
            <PackageBuilder
              onPublished={(pkg) => setToast(`Published "${pkg.name}" at ${money(pkg.pricePerPax)}/pax · agents can book it now`)}
            />
          ) : (
            <AiListing />
          )}
        </div>
        <AnimatePresence>
          {toast && (
            <motion.p
              role="status"
              className="absolute bottom-3 left-1/2 z-40 w-[min(26rem,90%)] -translate-x-1/2 bg-[#0f3b38] px-3 py-2 text-center text-sm font-semibold text-white"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </AppWindow>
      <DemoNote>Demo inventory, real mechanics: drag-and-drop package building, and an AI that eats long forms for breakfast.</DemoNote>
    </>
  )
}
