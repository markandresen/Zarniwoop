/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { ZarniwoopAPI } from '../electron/preload/index'

declare global {
  interface Window {
    zarniwoop: ZarniwoopAPI
  }
}

export {}
