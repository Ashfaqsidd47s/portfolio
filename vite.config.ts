import path from "node:path"
import { defineConfig, loadEnv, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/** Routes that should appear in the sitemap, with their relative priority. */
const ROUTES = [
  { path: "/", priority: "1.0", changefreq: "monthly" },
  { path: "/resume", priority: "0.8", changefreq: "monthly" },
]

/**
 * Emits robots.txt and sitemap.xml at build time so both stay in step with
 * VITE_SITE_URL instead of being hand-maintained.
 */
function seoFiles(siteUrl: string): Plugin {
  const origin = siteUrl.replace(/\/+$/, "")
  return {
    name: "seo-files",
    apply: "build",
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10)

      const urls = ROUTES.map(
        (r) => `  <url>
    <loc>${origin}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
      ).join("\n")

      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
      })

      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`,
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const siteUrl = env.VITE_SITE_URL || "http://localhost:5173"

  return {
    plugins: [react(), tailwindcss(), seoFiles(siteUrl)],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    build: {
      target: "es2022",
      cssMinify: "lightningcss",
      // Fingerprinted assets are served with a long max-age (see _headers).
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return
            if (/[\\/]node_modules[\\/](motion|framer-motion)[\\/]/.test(id)) {
              return "motion"
            }
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
                id
              )
            ) {
              return "react"
            }
          },
        },
      },
    },
  }
})
