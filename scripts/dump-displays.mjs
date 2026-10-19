import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { app, screen } = require('electron')

app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay()
  const dip = { x: d.bounds.x + d.bounds.width - 420, y: d.workArea.y, width: 420, height: d.workArea.height }
  const phys = screen.dipToScreenRect(null, dip)
  const back = screen.screenToDipRect(null, phys)
  console.log(JSON.stringify({ scale: d.scaleFactor, bounds: d.bounds, workArea: d.workArea, dip, phys, back }, null, 2))
  app.quit()
})
