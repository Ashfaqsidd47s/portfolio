import * as React from "react"
import { Check, Monitor, Moon, MousePointerClick, Power, RotateCcw, Sparkles, Sun } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"
import { useSettings } from "@/os/store/settings"
import { useUi } from "@/os/store/ui"
import { useSystemActions } from "@/os/system"
import { WallpaperThumb } from "@/os/wallpaper"
import { WALLPAPERS } from "@/os/wallpapers"

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-6 last:border-0">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ReactNode }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
            value === o.value ? "bg-elevated text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-border-strong")}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  )
}

const button =
  "inline-flex w-fit items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-40"

/** Clears every app's saved demo data (keys under "os:" except the settings themselves). */
function resetDemoData() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("os:") && key !== "os:settings:v1") window.localStorage.removeItem(key)
    }
  } catch {
    /* storage blocked: nothing saved to reset */
  }
  window.location.reload()
}

export default function Settings() {
  const { theme, toggle } = useTheme()
  const settings = useSettings()
  const system = useSystemActions()
  const moved = Object.keys(settings.iconCells).length > 0

  return (
    <div className="@container mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Section title="Wallpaper" description="Every scene has a day and a night version — they follow the theme.">
        <div role="radiogroup" aria-label="Wallpaper" className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
          {WALLPAPERS.map((w) => {
            const active = settings.wallpaper === w.id
            return (
              <button
                key={w.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-tour={`settings-wallpaper-${w.id}`}
                onClick={() => settings.setWallpaper(w.id)}
                className="group flex flex-col gap-1.5 text-left"
              >
                <span
                  className={cn(
                    "relative block overflow-hidden rounded-lg ring-1 ring-border transition-shadow",
                    active ? "ring-2 ring-accent" : "group-hover:ring-border-strong"
                  )}
                >
                  <WallpaperThumb id={w.id} />
                  {active && (
                    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium">{w.name}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Appearance">
        <Segmented
          label="Theme"
          value={theme}
          onChange={(t) => t !== theme && toggle()}
          options={[
            { value: "light", label: "Light", icon: <Sun className="size-3.5" /> },
            { value: "dark", label: "Dark", icon: <Moon className="size-3.5" /> },
          ]}
        />
      </Section>

      <Section title="Desktop" description="How icons open, and where they sit.">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointerClick className="size-3.5" aria-hidden /> Open icons with
          </span>
          <Segmented
            label="Open icons with"
            value={settings.clickMode}
            onChange={settings.setClickMode}
            options={[
              { value: "double", label: "Double-click" },
              { value: "single", label: "Single click" },
            ]}
          />
        </div>
        <button type="button" disabled={!moved} onClick={system.cleanUpIcons} className={button}>
          <Sparkles className="size-3.5" aria-hidden /> Clean up icons
        </button>
      </Section>

      <Section title="Screensaver" description="Starts after 90 seconds with no mouse or keyboard input.">
        <div className="flex items-center gap-3">
          <Switch checked={settings.screensaver} onChange={settings.setScreensaver} label="Screensaver" />
          <span className="text-xs">{settings.screensaver ? "On" : "Off"}</span>
          <button type="button" onClick={() => useUi.getState().setScreensaverOn(true)} className={cn(button, "ml-auto")}>
            <Monitor className="size-3.5" aria-hidden /> Preview
          </button>
        </div>
      </Section>

      <Section title="System">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={system.restart} className={button}>
            <Power className="size-3.5" aria-hidden /> Restart
          </button>
          <button type="button" onClick={resetDemoData} className={button}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset all demo data
          </button>
          <button type="button" onClick={system.about} className={button}>
            About Ashfaq OS
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Demo data lives only in this browser. Resetting brings every app back to its starting data and reloads the page.
        </p>
      </Section>
    </div>
  )
}
