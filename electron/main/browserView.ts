import { BrowserWindow, WebContentsView } from 'electron'

export type ChromeLayout = {
  toolbarHeight: number
  /** Right-side HTML chrome the native browser must not cover (chat / rail). */
  rightChrome: number
}

const DEFAULT_TOOLBAR = 48

/**
 * Browser surface as WebContentsView beside Svelte chrome.
 * showBrowser is controlled only by setBrowserCollapsed (avoids IPC races).
 */
export class BrowserViewManager {
  private view: WebContentsView
  private showBrowser = false
  private toolbarHeight = DEFAULT_TOOLBAR
  private rightChrome = 380
  private disposed = false
  private attached = false

  constructor(private readonly win: BrowserWindow) {
    this.view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.view.webContents.loadURL('https://example.com')
    this.relayout()
    this.win.on('resize', () => this.relayout())
  }

  setBrowserCollapsed(collapsed: boolean): void {
    this.showBrowser = !collapsed
    this.relayout()
  }

  setChromeLayout(partial: Partial<ChromeLayout>): void {
    const toolbarHeight = Number(partial.toolbarHeight)
    const rightChrome = Number(partial.rightChrome)
    if (Number.isFinite(toolbarHeight) && toolbarHeight >= 0) {
      this.toolbarHeight = Math.round(toolbarHeight)
    }
    if (Number.isFinite(rightChrome) && rightChrome >= 0) {
      this.rightChrome = Math.round(rightChrome)
    }
    this.relayout()
  }

  async navigate(url: string): Promise<{ ok: boolean; url: string; error?: string }> {
    let target = url.trim()
    if (!target) return { ok: false, url: '', error: 'empty' }
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`
    }
    try {
      await this.view.webContents.loadURL(target)
      this.relayout()
      return { ok: true, url: target }
    } catch (err) {
      return { ok: false, url: target, error: String(err) }
    }
  }

  getUrl(): string {
    return this.view.webContents.getURL()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    ;(this.view.webContents as unknown as { close?: () => void }).close?.()
  }

  private attach(): void {
    if (!this.attached) {
      this.win.contentView.addChildView(this.view)
      this.attached = true
    }
    this.view.setVisible(true)
  }

  private detach(): void {
    this.view.setVisible(false)
    this.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    if (this.attached) {
      this.win.contentView.removeChildView(this.view)
      this.attached = false
    }
  }

  private relayout(): void {
    if (this.disposed) return

    if (!this.showBrowser) {
      this.detach()
      return
    }

    const [contentW, contentH] = this.win.getContentSize()
    const top = Math.min(this.toolbarHeight, contentH)
    const side = Math.min(contentW, Math.max(0, this.rightChrome + 1))
    const width = contentW - side
    const height = contentH - top

    if (width < 120 || height < 80) {
      this.detach()
      return
    }

    this.attach()
    this.view.setBounds({ x: 0, y: top, width, height })
  }
}
