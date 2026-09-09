import * as React from "react"

type Theme = "light" | "dark"

const STORAGE_KEY = "portfolio-theme"

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
  } catch {
    /* storage can be unavailable — fall through to system preference */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

const ThemeContext = React.createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: "light", toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>(readInitialTheme)

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* non-fatal */
    }
  }, [theme])

  const toggle = React.useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  )

  const value = React.useMemo(() => ({ theme, toggle }), [theme, toggle])

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  return React.use(ThemeContext)
}
