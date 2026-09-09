/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Canonical origin the site is deployed to, without a trailing slash. */
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
