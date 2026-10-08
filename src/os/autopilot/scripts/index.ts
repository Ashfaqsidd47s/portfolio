import type { Tour } from "../run"
import { inWindow, type TourContext } from "../actions"
import { getApp } from "@/os/registry/apps"

/**
 * The tours the autopilot plays, in order: work projects first, then side
 * projects, then me. Each one opens its app from the desktop, does
 * something real in it, and leaves the desktop as it found it.
 */

const tn = (t: string) => inWindow("trypnow", t)

const trypnow: Tour<TourContext> = {
  id: "trypnow",
  name: "TrypNow",
  run: async (t) => {
    await t.openApp("trypnow")
    await t.say("TrypNow: a B2B travel marketplace. Let's build a holiday package.", 400)
    await t.click(tn("tn-nav-packages"))
    await t.click(tn("tn-new-package"))
    await t.say("Drag hotels and activities into the days…")
    // The builder opens with an example (days 1–2); fill day 3 and top up day 2.
    await t.click(tn("tn-kind-hotel"))
    await t.drag(tn("tn-item-h3"), tn("tn-day-2"))
    await t.click(tn("tn-kind-attraction"))
    await t.drag(tn("tn-item-a3"), tn("tn-day-2"))
    await t.drag(tn("tn-item-a2"), tn("tn-day-1"))
    await t.say("…and the price per person adds up as you go.", 1600)
    await t.click(tn("tn-nav-attractions"))
    await t.say("New attraction? Describe it like a human.")
    await t.type(
      tn("tn-ai-prompt"),
      "Sunset kayak tour around the Burj Al Arab. 2 hours, USD 65 per adult, pickup from Jumeirah. Life jackets and photos included.",
      { replace: true }
    )
    await t.click(tn("tn-ai-generate"))
    await t.say("The AI fills in every field of the listing.", 3800)
    await t.closeWindow("trypnow")
  },
}

/** Projects whose demo isn't built yet: open the case study, read through it, close. */
function caseStudy(id: string): Tour<TourContext> {
  const app = getApp(id)!
  return {
    id,
    name: app.name,
    run: async (t) => {
      await t.openApp(id)
      await t.say(`${app.name}: ${app.description}`, 1800)
      await t.scroll(`[data-window="${id}"] [data-window-body]`, 260)
      await t.wait(1400)
      await t.closeWindow(id)
    },
  }
}

/** Two windows side by side, by dragging their title bars onto the screen edges. */
const snapping: Tour<TourContext> = {
  id: "snap",
  name: "11Matrix + File Scanner",
  run: async (t) => {
    await t.openApp("11matrix")
    await t.say("Windows snap: drag one to the left edge…")
    await t.dragWindow("11matrix", { x: 2, y: window.innerHeight / 2 })
    await t.openApp("file-scanner")
    await t.say("…and another to the right.")
    await t.dragWindow("file-scanner", { x: window.innerWidth - 2, y: window.innerHeight / 2 })
    await t.say("Side by side, like a real desktop.", 2200)
    await t.closeWindow("file-scanner")
    await t.closeWindow("11matrix")
  },
}

const about: Tour<TourContext> = {
  id: "about",
  name: "About me",
  run: async (t) => {
    await t.openApp("about")
    await t.say("And that's me. Everything here is open: drag, click, break things.", 2000)
    await t.scroll(`[data-window="about"] [data-window-body]`, 320)
    await t.wait(1600)
    await t.closeWindow("about")
  },
}

export const playlist: Tour<TourContext>[] = [trypnow, caseStudy("suregem"), caseStudy("11jobs"), snapping, caseStudy("bingo-master"), about]
