import { BrowserWindow, WebContentsView } from 'electron'

const DEFAULT_SIDEBAR = 380
const TOOLBAR = 48

/**
 * Main browser surface as WebContentsView, laid out beside the Svelte chrome
 * (toolbar + AI sidebar live in the renderer; browser fills the remaining rect).
 */
export class BrowserViewManager {
  private view: WebContentsView
  private sidebarWidth = DEFAULT_SIDEBAR
  private sidebarCollapsed = false
  private disposed = false

  constructor(private readonly win: BrowserWindow) {
    this.view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.win.contentView.addChildView(this.view)
    this.view.webContents.loadURL('https://example.com')
    this.relayout()
    this.win.on('resize', () => this.relayout())
  }

  setSidebarWidth(width: number): void {
    this.sidebarWidth = Math.min(640, Math.max(280, width))
    this.relayout()
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed
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
    this.win.contentView.removeChildView(this.view)
    ;(this.view.webContents as unknown as { close?: () => void }).close?.()
  }

  private relayout(): void {
    if (this.disposed) return
    const [width, height] = this.win.getContentSize()
    const side = this.sidebarCollapsed ? 0 : this.sidebarWidth
    const browserWidth = Math.max(200, width - side)
    this.view.setBounds({
      x: 0,
      y: TOOLBAR,
      width: browserWidth,
      height: Math.max(100, height - TOOLBAR)
    })
  }
}
