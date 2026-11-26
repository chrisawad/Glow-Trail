import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

let url = process.env.TEST_URL
let staticServer
const route = [
  34, 33, 32, 31, 24, 17, 16, 23, 30, 29, 36, 37, 38, 39, 40, 41, 48,
  47, 46, 45, 44, 43, 42, 35, 28, 21, 14, 7, 0, 1, 2, 3, 4, 5, 6, 13,
  12, 19, 20, 27, 26, 25, 18, 11, 10, 9, 8, 15, 22,
]
let browser
before(async () => {
  if (!url) {
    const root = resolve('dist/client')
    const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'))
    const base = new URL(manifest.id, 'http://localhost/').pathname
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav' }
    staticServer = createServer(async (request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname
      const file = resolve(root, pathname.slice(base.length) || 'index.html')
      if (!pathname.startsWith(base) || !file.startsWith(root + sep)) { response.writeHead(404).end(); return }
      try {
        const bytes = await readFile(file)
        response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(bytes)
      } catch { response.writeHead(404).end() }
    })
    await new Promise(ready => staticServer.listen(0, '127.0.0.1', ready))
    url = 'http://127.0.0.1:' + staticServer.address().port + base
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
})
after(async () => {
  await browser?.close()
  staticServer?.closeAllConnections()
  staticServer?.close()
})

async function game(t, { installed = true, ...options } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options })
  t.after(() => context.close())
  if (installed) await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.goto(url)
  await page.locator('.trail-board').waitFor()
  return { page, context }
}

async function openSharedPuzzle(page, link, id) {
  assert.equal(link, 'https://glowtrail.chrisawad.com/#puzzle=' + encodeURIComponent(id))
  // The forwarding host returns a bare Location. Chromium must carry the fragment
  // across the real navigation, then the game promotes it to its usual query.
  await page.route('https://glowtrail.chrisawad.com/', route =>
    route.fulfill({ status: 301, headers: { location: url } }), { times: 1 })
  await page.goto(link)
  const destination = new URL(url)
  destination.searchParams.set('puzzle', id)
  await page.waitForURL(destination.href)
  assert.equal(page.url(), destination.href)
}

async function dismissInstall(page) {
  const dialog = page.getByRole('dialog', { name: 'Install Glow Trail', exact: true })
  await dialog.getByRole('button', { name: 'Back to puzzle' }).click()
  await dialog.waitFor({ state: 'hidden' })
}

async function point(page, cell) {
  const board = page.locator('.trail-board')
  await board.scrollIntoViewIfNeeded()
  const box = await board.boundingBox()
  return {
    x: box.x + (cell % 7 + .5) * box.width / 7,
    y: box.y + (Math.floor(cell / 7) + .5) * box.height / 7,
  }
}

async function clickCell(page, cell) {
  const { x, y } = await point(page, cell)
  await page.mouse.click(x, y)
}

async function keys(page, cells) {
  const board = page.locator('.trail-board')
  const directions = { '-7': 'ArrowUp', 7: 'ArrowDown', '-1': 'ArrowLeft', 1: 'ArrowRight' }
  await board.focus()
  for (let i = 1; i < cells.length; i++) await page.keyboard.press(directions[cells[i] - cells[i - 1]])
}

async function count(page, expected, label = 'Cells filled') {
  const meter = page.getByRole('progressbar', { name: label })
  await meter.locator('xpath=self::*[@value="' + expected + '"]').waitFor({ timeout: 3000 })
}

test('reference solution wins with all 15 dots and 49 cells; borrowed confetti and fanfare play', async t => {
  const { page } = await game(t)
  await page.evaluate(() => {
    window.celebrationAudio = { voices: 0, oscillators: 0 }
    for (const [method, key] of [['createBufferSource', 'voices'], ['createOscillator', 'oscillators']]) {
      const original = AudioContext.prototype[method]
      AudioContext.prototype[method] = function (...args) {
        window.celebrationAudio[key]++
        return original.apply(this, args)
      }
    }
  })
  await keys(page, route)
  await count(page, 49)
  await count(page, 15, 'Dots connected')
  await page.getByRole('heading', { name: 'Trail complete!' }).waitFor()
  assert.equal(await page.locator('.board-grid').getAttribute('opacity'), '0')
  assert.equal(await page.locator('.trail-board line').count(), 48)
  assert.deepEqual(await page.locator('.trail-board text').allTextContents(), Array.from({length:15}, (_, i) => String(i + 1)))
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.win-confetti')
    const ctx = canvas.getContext('2d')
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((v,i) => i % 4 === 3 && v > 0)
  })
  await page.waitForFunction(() => window.celebrationAudio.voices > 0 && window.celebrationAudio.oscillators >= 8)
  const completedAt = await page.locator('.timer strong').innerText()
  await page.waitForTimeout(1150)
  assert.equal(await page.locator('.timer strong').innerText(), completedAt)
  await page.reload()
  await count(page, 49)
  await page.getByRole('button', { name: 'Next puzzle' }).click()
  await count(page, 1)
  assert.equal(await page.locator('.puzzle-id').innerText().then(s => s.toLowerCase()), 'puzzle 02')
})

test('skipped dots, diagonal moves, revisits and the final dot reached too early are rejected', async t => {
  const { page } = await game(t)
  await clickCell(page, 26)
  await count(page, 1)
  await keys(page, [34, 27, 26])
  await count(page, 2)
  await count(page, 1, 'Dots connected')
  await keys(page, [27, 34])
  await count(page, 1)
  await keys(page, [34, 27, 20, 13, 6, 5, 12, 13])
  await count(page, 7)
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Reset trail' }).click()
  // Shortcut from 5 down to 12 skips two unnumbered cells. Every dot up to 14 is legal.
  await keys(page, route.filter(cell => cell !== 6 && cell !== 13))
  await count(page, 46)
  await count(page, 14, 'Dots connected')
  assert.equal(await page.getByText('Trail complete!', { exact: true }).count(), 0)
})

test('dragging, undo, hints, canceling a reset, puzzle switching and saved progress', async t => {
  const { page } = await game(t)
  const start = await point(page, 34)
  const secondDot = await point(page, 31)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(secondDot.x, secondDot.y)
  await page.mouse.up()
  await count(page, 4)
  await count(page, 2, 'Dots connected')
  await page.getByRole('button', { name: 'Undo' }).click()
  await count(page, 3)
  await page.getByRole('button', { name: 'Hint' }).click()
  await count(page, 4)
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  const pausedAt = await page.locator('.timer strong').innerText()
  await page.waitForTimeout(1100)
  assert.equal(await page.locator('.timer strong').innerText(), pausedAt)
  await page.getByRole('button', { name: 'Keep playing' }).click()
  await count(page, 4)
  await page.waitForTimeout(1050)
  await page.reload()
  await count(page, 4)
  assert.notEqual(await page.locator('.timer strong').innerText(), '0:00')
  await page.getByRole('button', { name: 'Puzzle book' }).click()
  await page.locator('.puzzle-choice').nth(1).click()
  await count(page, 1)
  await page.getByRole('button', { name: 'Puzzle book' }).click()
  await page.locator('.puzzle-choice').first().click()
  await count(page, 4)
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Reset trail' }).click()
  await count(page, 1)
  await clickCell(page, 27)
  await page.getByRole('button', { name: 'Hint' }).click()
  await count(page, 1)
})

test('phone touch drag, standalone installability, offline reload and play', async t => {
  const { context, page } = await game(t, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  const cdp = await context.newCDPSession(page)
  const { manifest } = await page.evaluate(async () => {
    const manifest = await fetch(document.querySelector('link[rel=manifest]').href).then(r => r.json())
    return { manifest }
  })
  assert.equal(manifest.name, 'Glow Trail')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.icons.some(i => i.sizes.includes('512x512')))
  assert.ok(manifest.icons.some(i => i.sizes.includes('192x192')))
  const start = await point(page, 34)
  const end = await point(page, 31)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await count(page, 4)
  await context.setOffline(true)
  await page.reload()
  await count(page, 4)
  const next = await point(page, 24)
  await page.touchscreen.tap(next.x, next.y)
  await count(page, 5)
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    return ['Fredoka','Nunito'].map(f => [...document.fonts].some(face => face.family === f && face.status === 'loaded'))
  })
  assert.deepEqual(fonts, [true,true])
})

test('puzzle and controls fit desktop, narrow phones and phone landscape', async t => {
  const { page } = await game(t)
  for (const [width,height] of [[1440,900],[1280,720],[320,568],[390,844],[667,375],[568,320]]) {
    await page.setViewportSize({ width,height })
    await page.evaluate(() => window.scrollTo(0, 0))
    const board = await page.locator('.trail-board').boundingBox()
    const controls = await page.locator('.actions').boundingBox()
    assert.ok(Math.abs(board.width - board.height) < 2)
    assert.ok(board.x >= 0 && board.x + board.width <= width)
    assert.ok(controls.y + controls.height <= height + 1, width + ' × ' + height + ' controls bottom: ' + (controls.y + controls.height))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
})

test('landscape board position defaults to right and survives rotation and reload', async t => {
  const { page } = await game(t)
  const settings = page.getByRole('button', { name: 'Settings', exact: true })
  const position = page.getByRole('group', { name: 'Landscape board position' })
  const left = position.getByRole('radio', { name: 'Left', exact: true })
  const right = position.getByRole('radio', { name: 'Right', exact: true })

  async function checkLandscape(side) {
    for (const [width, height] of [[1280, 900], [1280, 720], [740, 600], [844, 390], [568, 320]]) {
      await page.setViewportSize({ width, height })
      const board = await page.locator('.trail-board').boundingBox()
      const info = await page.locator('.tracker').boundingBox()
      assert.ok(side === 'right' ? board.x >= info.x + info.width : board.x + board.width <= info.x,
        'Expected board on the ' + side + ' at ' + width + ' × ' + height)
      assert.ok(board.y < info.y + info.height && info.y < board.y + board.height, 'Panels should be side by side')
      if (height <= 390) {
        const screen = width + ' × ' + height + ' with board on ' + side
        assert.ok(Math.abs(board.height - board.width) < 2 && board.height >= height * .85, screen + ': expected a large square board')
        assert.ok(board.y >= 0 && board.y + board.height <= height + 1, screen + ': board should fit vertically')
        const controls = page.locator('.nav-tools button:visible, .actions button:visible')
        const panels = page.locator('.brand:visible, .game-heading h1, .timer, .tracker, .action-feedback')
        const tip = await page.locator('.action-feedback').boundingBox()
        const actions = await page.locator('.actions').boundingBox()
        assert.ok(tip && actions && tip.y >= info.y + info.height - 1 && actions.y >= tip.y + tip.height - 1,
          screen + ': the tip and game actions should follow the tracker')
        assert.ok(await page.getByRole('button', { name: 'How to play', exact: true }).isVisible(), screen + ': help should be available')
        for (const item of [...await controls.all(), ...await panels.all()]) {
          const bounds = await item.boundingBox()
          const name = await item.getAttribute('aria-label') || await item.textContent()
          assert.ok(bounds && bounds.width > 0 && bounds.height > 0, screen + ': ' + name + ' should be available')
          assert.ok(side === 'right' ? bounds.x + bounds.width <= board.x : bounds.x >= board.x + board.width,
            screen + ': ' + name + ' should be opposite the board')
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, screen + ': ' + name + ' should fit horizontally')
        }
        for (const button of await controls.all()) {
          const bounds = await button.boundingBox()
          assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1, screen + ': keep toolbar and game actions in view')
        }
      }
    }
  }

  async function checkPortrait() {
    await page.setViewportSize({ width: 390, height: 844 })
    const board = await page.locator('.board-frame').boundingBox()
    const info = await page.locator('.tracker').boundingBox()
    assert.ok(info.y >= board.y + board.height)
    assert.ok(Math.abs(info.x - board.x) < 1)
  }

  async function checkHelp() {
    await page.getByRole('button', { name: 'How to play', exact: true }).click()
    const help = page.getByRole('dialog', { name: 'How to play', exact: true })
    await help.waitFor()
    await page.keyboard.press('Escape')
    await help.waitFor({ state: 'hidden' })
    await count(page, 2)
  }

  await checkLandscape('right')
  await clickCell(page, 33)
  await count(page, 2)
  await checkHelp()
  await settings.click()
  assert.ok(await right.isChecked())
  await right.focus()
  await page.keyboard.press('ArrowLeft')
  assert.ok(await left.isChecked())
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await checkLandscape('left')
  await checkHelp()
  await checkPortrait()
  await page.reload()
  await count(page, 2)
  await checkLandscape('left')
  await settings.click()
  assert.ok(await left.isChecked())
  await position.getByText('Right', { exact: true }).click()
  assert.ok(await right.isChecked())
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await checkPortrait()
  await checkLandscape('right')
  await clickCell(page, 32)
  await count(page, 3)
})

test('reset confirmation keeps its title, consequence, and both choices visible on small screens', async t => {
  const { page } = await game(t, { isMobile: true, hasTouch: true })
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  await count(page, 2)
  for (const [width, height] of [[320, 568], [390, 720], [568, 320]]) {
    await page.setViewportSize({ width, height })
    await page.getByRole('button', { name: 'Puzzle book' }).click()
    await page.locator('.puzzle-choice').last().scrollIntoViewIfNeeded()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'Reset this trail?' })
    await panel.waitFor()
    const keep = panel.getByRole('button', { name: 'Keep playing' })
    assert.ok(await keep.evaluate(button => button === document.activeElement))
    const visible = await panel.evaluate(dialog => {
      const box = dialog.getBoundingClientRect()
      const children = [...dialog.querySelectorAll('h1, p, button')]
      return box.top >= 0 && box.bottom <= innerHeight && dialog.scrollTop === 0 && children.every(child => {
        const bounds = child.getBoundingClientRect()
        return bounds.top >= box.top && bounds.bottom <= box.bottom && bounds.left >= box.left && bounds.right <= box.right
      })
    })
    assert.ok(visible, 'All reset details should fit at ' + width + ' × ' + height)
    await keep.click()
    await count(page, 2)
  }
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await page.getByRole('button', { name: 'Reset trail' }).click()
  await count(page, 1)
})

test('Chromium installs the app and opens it in a standalone window', async t => {
  const context = await chromium.launchPersistentContext('', {
    executablePath: process.env.CHROMIUM_PATH, channel: 'chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  t.after(() => context.close())
  const page = context.pages()[0] || await context.newPage()
  await page.goto(url)
  await dismissInstall(page)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  const cdp = await context.newCDPSession(page)
  assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors, [])
  const { manifestId } = await cdp.send('Page.getAppManifest')
  const app = {manifestId: manifestId || new URL('./', url).href}
  await cdp.send('PWA.install', { ...app, installUrlOrBundleUrl: url })
  await cdp.send('PWA.changeAppUserSettings', { ...app, displayMode: 'standalone' })
  const opened = context.waitForEvent('page', { timeout: 10000 })
  await cdp.send('PWA.launch', app)
  const standalone = await opened
  await standalone.waitForFunction(() => window.matchMedia('(display-mode: standalone)').matches)
  await standalone.locator('.trail-board').waitFor()
  assert.equal(await standalone.getByRole('dialog', { name: 'Install Glow Trail' }).isVisible(), false)
  assert.equal(await standalone.getByRole('button', { name: 'Install Glow Trail' }).count(), 0)
  await context.setOffline(true)
  await standalone.reload()
  await keys(standalone, [34, 33])
  await count(standalone, 2)
  await cdp.send('PWA.uninstall', app)
})

test('uninstalled visitors see one automatic install offer per visit and can reopen it from the toolbar', async t => {
  const { page } = await game(t, { installed: false })
  const offer = page.getByRole('navigation', { name: 'Game controls' }).getByRole('button', { name: 'Install Glow Trail' })
  const dialog = page.getByRole('dialog', { name: 'Install Glow Trail', exact: true })
  await dismissInstall(page)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await clickCell(page, 33)
  await count(page, 2)
  await offer.click()
  await dismissInstall(page)
  await page.reload()
  await dismissInstall(page)
  await count(page, 2)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await dismissInstall(page)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await dismissInstall(page)
  await clickCell(page, 32)
  await count(page, 3)
  assert.equal(await dialog.isVisible(), false)
})

test('sharing opens the chosen board and settings persist', async t => {
  const { context, page } = await game(t)
  await page.getByRole('button', { name: 'Settings' }).click()
  const sound = page.getByRole('switch', { name: 'Celebration sound' })
  await sound.click()
  await page.getByText('Meadow', { exact: true }).click()
  assert.equal(await sound.getAttribute('aria-checked'), 'false')
  await page.keyboard.press('Escape')
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  assert.equal(await sound.getAttribute('aria-checked'), 'false')
  assert.ok(await page.getByRole('radio', { name: 'Meadow' }).isChecked())
  assert.equal(await page.locator('.board-frame').getAttribute('data-trail'), 'Meadow')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Puzzle book' }).click()
  await page.locator('.puzzle-choice').nth(1).click()
  const title = await page.locator('.game-heading h1').innerText()
  await page.evaluate(() => Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: async payload => { window.sharedPuzzle = payload },
  }))
  await page.getByRole('button', { name: 'Share puzzle' }).click()
  const link = await page.getByLabel('Puzzle link').inputValue()
  const origin = new URL(url).origin
  await context.grantPermissions(['clipboard-read','clipboard-write'], { origin })
  await page.getByRole('button', { name: 'Copy link' }).click()
  await page.getByText('Link copied.', { exact: true }).waitFor()
  const expected = 'https://glowtrail.chrisawad.com/#puzzle=clover-bend'
  assert.equal(link, expected)
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  assert.equal(copied, expected)
  await page.getByRole('dialog').getByRole('button', { name: 'Share', exact: true }).click()
  assert.equal(await page.evaluate(() => window.sharedPuzzle.url), expected)
  // The recipient opens the shared link in a browser tab with the PWA already installed.
  const recipient = await browser.newContext()
  t.after(() => recipient.close())
  await recipient.addInitScript(() => Object.defineProperty(navigator, 'getInstalledRelatedApps', {
    value: async () => [{ platform: 'webapp', url: document.querySelector('link[rel=manifest]').href }],
  }))
  const other = await recipient.newPage()
  await openSharedPuzzle(other, copied, 'clover-bend')
  assert.equal(await other.locator('.game-heading h1').innerText(), title)
  await other.getByRole('button', { name: 'Settings' }).click()
  await other.getByText('Installed', { exact: true }).waitFor()
  assert.equal(await other.getByRole('button', { name: 'Install Glow Trail', includeHidden: true }).count(), 0)
})

test('every board in the book has a playable solution, with quiet wins for reduced motion and muted sound', async t => {
  const { page } = await game(t, { reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('switch', { name: 'Celebration sound' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Puzzle book' }).click()
  const total = await page.locator('.puzzle-choice').count()
  assert.ok(total >= 3)
  await page.keyboard.press('Escape')
  const names = new Set()
  for (let i = 0; i < total; i++) {
    names.add(await page.locator('.game-heading h1').innerText())
    const cells = Number(await page.getByRole('progressbar', { name: 'Cells filled' }).getAttribute('max'))
    for (let step = 1; step < cells; step++) await page.getByRole('button', { name: 'Hint', exact: true }).dispatchEvent('click')
    await count(page, cells)
    await page.getByRole('heading', { name: 'Trail complete!' }).waitFor()
    assert.ok(await page.evaluate(() => {
      const canvas = document.querySelector('.win-confetti')
      return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.every(v => !v)
    }))
    if (i + 1 < total) await page.getByRole('button', { name: 'Next puzzle' }).click()
  }
  assert.equal(names.size, total)
})

test('a known v1 shared puzzle keeps its original checkpoints and winning route', async t => {
  const { page } = await game(t, { reducedMotion: 'reduce' })
  const link = new URL(url)
  link.searchParams.set('puzzle', 'random-v1-00c0ffee')
  await page.goto(link.href)
  await page.getByRole('heading', { name: 'Indigo Cascade' }).waitFor()

  const checkpoints = await page.locator('.trail-board text').evaluateAll(labels => labels.map(label => {
    const cellSize = label.ownerSVGElement.viewBox.baseVal.width / 7
    const column = Math.floor(label.x.baseVal[0].value / cellSize)
    const row = Math.floor(label.y.baseVal[0].value / cellSize)
    return row * 7 + column
  }))
  assert.deepEqual(checkpoints, [36, 44, 38, 33, 40, 32, 28, 1, 23, 5, 11, 27, 10])
  await keys(page, [
    36, 35, 42, 43, 44, 37, 38, 45, 46, 47, 48, 41, 34, 33, 40, 39, 32,
    31, 30, 29, 28, 21, 14, 7, 0, 1, 8, 15, 22, 23, 16, 9, 2, 3, 4, 5,
    6, 13, 12, 11, 18, 19, 20, 27, 26, 25, 24, 17, 10,
  ])
  await count(page, 49)
  await count(page, 13, 'Dots connected')
  await page.getByRole('heading', { name: 'Trail complete!' }).waitFor()
})

test('a long puzzle book opens on the active page and allows selection across pages', async t => {
  const { page } = await game(t)
  await page.evaluate(() => {
    const ids = Array.from({ length: 12 }, (_, i) => 'random-v1-' + i.toString(16).padStart(8, '0'))
    localStorage.setItem('glow-trail.games.v1.book', JSON.stringify(ids))
    localStorage.setItem('glow-trail.games.v1', JSON.stringify({ active: ids.at(-1), runs: {} }))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Puzzle book' }).click()
  const pages = page.getByRole('navigation', { name: 'Puzzle book pages' })
  await pages.getByText('Page 2 of 2').waitFor()
  assert.equal(await pages.getByRole('button', { name: 'Next' }).isDisabled(), true)
  assert.deepEqual(await page.locator('.puzzle-choice small').allTextContents(), ['Puzzle 17', 'Puzzle 18', 'Puzzle 19', 'Puzzle 20'])

  await pages.getByRole('button', { name: 'Previous' }).click()
  await pages.getByText('Page 1 of 2').waitFor()
  assert.equal(await pages.getByRole('button', { name: 'Previous' }).isDisabled(), true)
  assert.equal(await page.locator('.puzzle-choice').count(), 16)
  await pages.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /Puzzle 17/ }).click()
  assert.equal((await page.locator('.puzzle-id').innerText()).toLowerCase(), 'puzzle 17')
})

test('the eight fixed puzzles lead into replayable, shareable random puzzles, including offline', async t => {
  const { page, context } = await game(t, { reducedMotion: 'reduce' })
  // This is the save format shipped before generated levels existed.
  await page.evaluate(() => {
    localStorage.setItem('glow-trail.games.v1', JSON.stringify({
      active: 'midnight-loop',
      runs: { 'midnight-loop': { path: [14, 7], elapsed: 12000, started: true, best: null } },
    }))
    localStorage.setItem('glow-trail.muted', 'true')
  })
  await page.reload()
  await count(page, 2)
  await page.getByRole('button', { name: 'Puzzle book' }).click()
  const fixedNames = ['First Light', 'Clover Bend', 'Firefly Run', 'Violet Vale', 'Honeycomb', 'Starlight Steps', 'Moonlit Switchback', 'Midnight Loop']
  assert.deepEqual(await page.locator('.puzzle-choice strong').allTextContents(), fixedNames)
  await page.keyboard.press('Escape')

  async function finish(target) {
    const filled = target.getByRole('progressbar', { name: 'Cells filled' })
    assert.equal(await filled.getAttribute('max'), '49')
    for (let n = Number(await filled.getAttribute('value')); n < 49; n++) {
      await target.getByRole('button', { name: 'Hint', exact: true }).click()
      await count(target, n + 1)
    }
    await target.getByRole('heading', { name: 'Trail complete!' }).waitFor()
  }
  const dots = target => target.locator('.trail-board text').evaluateAll(labels =>
    labels.map(label => [label.textContent, label.getAttribute('x'), label.getAttribute('y')]))
  const segments = target => target.locator('.trail-board line').evaluateAll(lines =>
    lines.map(line => ['x1','y1','x2','y2'].map(axis => line.getAttribute(axis))))

  await finish(page)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Next puzzle' }).click()
  await count(page, 1)
  assert.equal((await page.locator('.puzzle-id').innerText()).toLowerCase(), 'puzzle 09')
  const ninthDots = await dots(page)
  const ninthName = await page.locator('.game-heading h1').innerText()
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  await page.reload()
  await count(page, 2)
  assert.deepEqual(await dots(page), ninthDots)
  await page.getByRole('button', { name: 'Share puzzle' }).click()
  const link = await page.getByLabel('Puzzle link').inputValue()
  const sharedId = await page.evaluate(() => JSON.parse(localStorage.getItem('glow-trail.games.v1')).active)
  assert.match(sharedId, /^random-v1-[a-f0-9]{8}$/)
  await page.keyboard.press('Escape')

  const recipient = await browser.newContext({ reducedMotion: 'reduce' })
  t.after(() => recipient.close())
  const shared = await recipient.newPage()
  await openSharedPuzzle(shared, link, sharedId)
  await dismissInstall(shared)
  await count(shared, 1)
  assert.equal(await shared.locator('.game-heading h1').innerText(), ninthName)
  assert.deepEqual(await dots(shared), ninthDots)
  await finish(shared)
  await finish(page)
  assert.deepEqual(await segments(page), await segments(shared))

  await page.getByRole('button', { name: 'Replay' }).click()
  await page.getByRole('button', { name: 'Play again', exact: true }).click()
  await count(page, 1)
  assert.deepEqual(await dots(page), ninthDots)
  await finish(page)
  await page.getByRole('button', { name: 'Next puzzle' }).click()
  await count(page, 1)
  assert.equal((await page.locator('.puzzle-id').innerText()).toLowerCase(), 'puzzle 10')
  assert.notDeepEqual(await dots(page), ninthDots)
  await page.getByRole('button', { name: 'Puzzle book' }).click()
  assert.equal(await page.locator('.puzzle-choice').count(), 10)
  assert.deepEqual((await page.locator('.puzzle-choice strong').allTextContents()).slice(0,8), fixedNames)
  await page.locator('.puzzle-choice').filter({ hasText: 'Midnight Loop' }).first().click()
  await page.getByRole('button', { name: 'Next puzzle' }).click()
  await count(page, 49)
  assert.deepEqual(await dots(page), ninthDots)
})

test('the install button uses browser consent, supports cancellation, and offers again after uninstall', async t => {
  const { page } = await game(t, { installed: false })
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'install', { configurable: true, value: undefined })
    window.installCalls = 0
    window.offerInstallForTest = outcome => {
      const event = new Event('beforeinstallprompt', {cancelable: true})
      Object.assign(event, {prompt: async () => { window.installCalls++ }, userChoice: Promise.resolve({outcome})})
      window.dispatchEvent(event)
    }
    window.offerInstallForTest('dismissed')
  })
  const offer = page.getByRole('button', { name: 'Install Glow Trail' })
  const installDialog = page.getByRole('dialog', { name: 'Install Glow Trail' })
  await installDialog.waitFor()
  assert.equal(await page.evaluate(() => window.installCalls), 0)
  await installDialog.getByRole('button', { name: 'Install app', exact: true }).click()
  await page.getByText('Installation canceled. You can keep playing here.').waitFor()
  await page.evaluate(() => window.offerInstallForTest('accepted'))
  await page.getByRole('button', { name: 'Install app', exact: true }).click()
  await page.getByText('Glow Trail is installed on this device.').waitFor()
  await page.getByRole('button', { name: 'Back to puzzle' }).click()
  assert.equal(await page.evaluate(() => window.installCalls), 2)
  assert.equal(await offer.count(), 0)
  await page.evaluate(() => window.offerInstallForTest('dismissed'))
  await offer.waitFor()
})

test('an HTTP LAN visit can detect, defer and apply a new build while preserving the puzzle', async t => {
  const ctx = await browser.newContext()
  t.after(async () => {
    await ctx.unrouteAll({ behavior: 'wait' })
    await ctx.close()
  })
  const page = await ctx.newPage()
  const served = new URL(url)
  const preview = new URL(served.pathname + '?puzzle=first-light', 'http://glow-trail-preview.test')
  const revision = (await (await fetch(new URL('version.txt', url))).text()).trim()
  assert.match(revision, /^[a-f0-9]{16}$/)
  let serverVersion = revision
  let shellVersion = revision
  let versionReads = 0
  // Intercept a non-loopback HTTP origin so Chromium uses its real insecure-context rules.
  await ctx.route(preview.origin + '/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/version.txt')) {
      versionReads++
      await route.fulfill({ contentType: 'text/plain', body: serverVersion })
      return
    }
    const response = await route.fetch({ url: new URL(path, served.origin).href })
    if (request.resourceType() === 'document') {
      const html = (await response.text()).replace('content="' + revision + '"', 'content="' + shellVersion + '"')
      await route.fulfill({ response, body: html })
    } else await route.fulfill({ response })
  })
  await page.goto(preview.href)
  assert.equal(await page.evaluate(() => window.isSecureContext || 'serviceWorker' in navigator), false)
  await dismissInstall(page)
  await clickCell(page, 33)
  await count(page, 2)
  assert.equal(versionReads, 1)
  const updateDialog = page.getByRole('dialog', { name: 'Game update ready' })
  assert.equal(await updateDialog.isVisible(), false)

  serverVersion = revision === '1111111111111111' ? '2222222222222222' : '1111111111111111'
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Check now' }).click()
  await page.getByText('An update is ready.').waitFor()
  await page.getByRole('button', { name: 'Close Settings' }).click()
  await updateDialog.getByRole('button', { name: 'Later' }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await clickCell(page, 32)
  await count(page, 3)
  assert.equal(versionReads, 2)
  const resumedCheck = page.waitForResponse(response => response.url().endsWith('/version.txt'))
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await resumedCheck
  await updateDialog.waitFor()
  await updateDialog.getByRole('button', { name: 'Later' }).click()
  // A cold visit can receive the previous HTML from a browser cache.
  await page.reload()
  const firstDialog = page.getByRole('dialog')
  await firstDialog.waitFor()
  assert.equal(await firstDialog.getByRole('heading').innerText(), 'Game update ready')
  shellVersion = serverVersion
  await Promise.all([page.waitForEvent('load'), updateDialog.getByRole('button', { name: 'Update now' }).click()])
  assert.equal(page.url(), preview.href)
  assert.equal(await page.locator('meta[name="glow-trail-build"]').getAttribute('content'), serverVersion)
  await dismissInstall(page)
  await count(page, 3)
  assert.equal(await updateDialog.isVisible(), false)
})

test('a waiting update prompts once per visit and can be applied without losing a move', async t => {
  let version = 1
  // A disposable origin serves the actual game with two consecutive worker revisions.
  const proxy = createServer(async (request, response) => {
    try {
      if (request.url.endsWith('/keep-open')) {
        response.writeHead(200, { 'content-type': 'text/html' }).end('<title>Worker client</title>')
        return
      }
      const upstream = await fetch(new URL(request.url, url))
      const worker = request.headers['service-worker'] === 'script'
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store' })
      const bytes = Buffer.from(await upstream.arrayBuffer())
      response.end(worker ? Buffer.concat([bytes, Buffer.from('\nself.addEventListener("message", e => { if(e.data === "test-version") e.ports[0].postMessage(' + version + '); });')]) : bytes)
    } catch (error) { response.writeHead(502); response.end(String(error)) }
  })
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
  t.after(() => { proxy.closeAllConnections(); proxy.close() })
  const ctx = await browser.newContext()
  t.after(() => ctx.close())
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const gameUrl = 'http://127.0.0.1:' + proxy.address().port + new URL(url).pathname
  await page.goto(gameUrl)
  await dismissInstall(page)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  const updateDialog = page.getByRole('dialog', { name: 'Game update ready' })
  const later = updateDialog.getByRole('button', { name: 'Later' })
  assert.equal(await updateDialog.isVisible(), false)
  await clickCell(page, 33)
  await count(page, 2)
  // Keep version 1 active across reload, just as another open game tab would.
  const client = await ctx.newPage()
  await client.goto(new URL('keep-open', gameUrl).href)
  await client.waitForFunction(() => !!navigator.serviceWorker.controller)
  await page.bringToFront()
  version = 2
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
  await later.click()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await clickCell(page, 32)
  await count(page, 3)
  assert.equal(await updateDialog.isVisible(), false)

  // Exercise tab and page-cache lifecycle events independently of headless tab visibility.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    delete document.hidden
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await updateDialog.waitFor()
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await later.click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Close Settings' }).click()
  assert.equal(await updateDialog.isVisible(), false)
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await later.click()
  await page.reload()
  const firstDialog = page.getByRole('dialog')
  await firstDialog.waitFor()
  assert.equal(await firstDialog.getByRole('heading').innerText(), 'Game update ready')
  await later.click()
  await count(page, 3)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Update available' }).click()
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update now' }).click()])
  await dismissInstall(page)
  await count(page, 3)
  const current = await page.evaluate(() => new Promise(resolve => {
    const channel = new MessageChannel()
    channel.port1.onmessage = e => resolve(e.data)
    navigator.serviceWorker.controller.postMessage('test-version', [channel.port2])
  }))
  assert.equal(current, 2)
  assert.deepEqual(errors, [])
})
