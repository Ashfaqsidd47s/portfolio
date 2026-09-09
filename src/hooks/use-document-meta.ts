import { useEffect } from "react"

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/+$/, "")

function setMeta(selector: string, attr: "content" | "href", value: string) {
  const el = document.head.querySelector<HTMLElement>(selector)
  if (el) el.setAttribute(attr, value)
}

/**
 * Keeps the document head in step with the active route. The index.html tags
 * cover the home page and are what crawlers see first; this updates them for
 * client-side navigations and for anything rendering /resume directly.
 */
export function useDocumentMeta({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}) {
  useEffect(() => {
    document.title = title
    setMeta('meta[name="description"]', "content", description)
    setMeta('meta[property="og:title"]', "content", title)
    setMeta('meta[property="og:description"]', "content", description)
    setMeta('meta[name="twitter:title"]', "content", title)
    setMeta('meta[name="twitter:description"]', "content", description)

    if (SITE_URL) {
      const url = `${SITE_URL}${path}`
      setMeta('link[rel="canonical"]', "href", url)
      setMeta('meta[property="og:url"]', "content", url)
    }
  }, [title, description, path])
}
