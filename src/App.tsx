import { lazy, Suspense } from "react"
import { Routes, Route, useLocation } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Nav } from "@/components/nav"
import { Footer } from "@/components/footer"
import { ScrollProgress } from "@/components/scroll-progress"
import Home from "@/pages/home"

// The résumé and 404 are secondary routes — keep them out of the entry chunk.
const Resume = lazy(() => import("@/pages/resume"))
const NotFound = lazy(() => import("@/pages/not-found"))

function Page({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) return <>{children}</>
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.main>
  )
}

/** Holds layout height while a lazy route loads, so the footer doesn't jump. */
function RouteFallback() {
  return <div className="min-h-[70svh]" />
}

export default function App() {
  const location = useLocation()
  // The home page is a self-contained game with its own HUD and ending.
  const isJourney = location.pathname === "/"

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
      >
        Skip to content
      </a>
      {!isJourney && (
        <>
          <ScrollProgress />
          <Nav />
        </>
      )}
      <div id="main">
        <Suspense fallback={<RouteFallback />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  <Page>
                    <Home />
                  </Page>
                }
              />
              <Route
                path="/resume"
                element={
                  <Page>
                    <Resume />
                  </Page>
                }
              />
              <Route
                path="*"
                element={
                  <Page>
                    <NotFound />
                  </Page>
                }
              />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </div>
      {!isJourney && <Footer />}
    </>
  )
}
