import { shell, type BrowserWindow } from 'electron'

export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * App-chrome windows carry the privileged preload — never let them load other content.
 * New windows are denied; http(s) links go to the system browser.
 */
export function lockAppWindowNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })
}
