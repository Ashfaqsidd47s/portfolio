import * as React from "react"
import { RotateCcw } from "lucide-react"
import { apps, type AppDef } from "@/os/registry/apps"

// One lazy component per app, made once — never during render.
const lazyApps = new Map(apps.flatMap((a) => (a.load ? [[a.id, React.lazy(a.load)] as const] : [])))

/** Warm an app's chunk before it's opened, e.g. on icon hover. */
export function preloadApp(app: AppDef) {
  void app.load?.()
}

class AppErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null; attempt: number }
> {
  state = { error: null as Error | null, attempt: 0 }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) {
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>
    }
    return (
      <div role="alert" className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-sm font-semibold">{this.props.name} quit unexpectedly.</p>
          <p className="mt-1 text-xs text-muted-foreground">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Reopen
          </button>
        </div>
      </div>
    )
  }
}

function AppLoading({ name }: { name: string }) {
  return (
    <div className="grid h-full place-items-center" aria-busy="true">
      <p className="animate-pulse text-xs text-muted-foreground">Opening {name}…</p>
    </div>
  )
}

/** Loads and runs one app, isolated so a crash only takes down its own window. */
export function AppHost({ app, isPhone }: { app: AppDef; isPhone: boolean }) {
  const Component = lazyApps.get(app.id)
  if (!Component) return null
  return (
    <AppErrorBoundary name={app.name}>
      <React.Suspense fallback={<AppLoading name={app.name} />}>
        {/* Looked up, not created: each lazy component is built once at module load. */}
        {/* oxlint-disable-next-line react/static-components */}
        <Component appId={app.id} isPhone={isPhone} />
      </React.Suspense>
    </AppErrorBoundary>
  )
}
