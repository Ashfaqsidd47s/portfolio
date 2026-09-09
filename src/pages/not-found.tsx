import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDocumentMeta } from "@/hooks/use-document-meta"

export default function NotFound() {
  useDocumentMeta({
    title: "Page not found — Mohammad Ashfaq",
    description: "This page doesn't exist.",
    path: "/404",
  })

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-6xl flex-col justify-center px-5 py-32 sm:px-8">
      <p className="label-mono text-accent">Error 404</p>
      <h1 className="display mt-5 text-[clamp(2.25rem,7vw,4rem)]">
        This page doesn't exist.
      </h1>
      <p className="mt-5 max-w-md text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
        The link may be out of date, or the page may have moved. Everything
        worth seeing is on the home page.
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/">
            <ArrowLeft /> Back to portfolio
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/resume">View résumé</Link>
        </Button>
      </div>
    </div>
  )
}
