import { chromium } from 'playwright'
for (const backend of ['default', 'swiftshader']) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: [...(backend === 'default' ? [] : [`--use-angle=${backend}`, '--enable-unsafe-swiftshader']), '--autoplay-policy=no-user-gesture-required'] })
  let page
  try {
    page = await browser.newPage({ reducedMotion: 'no-preference' })
    await page.goto('http://127.0.0.1:5173/?live', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.__GENESIS__?.ready, null, { timeout: 60000 })
    const measurements = []
    for (const t of [5, 9, 12, 17, 26]) {
      await page.evaluate(time => { window.__GENESIS__.render(time, 1920, 1080) }, t)
      measurements.push({ t, ms: (await page.evaluate(() => window.__GENESIS__.state)).renderMs })
    }
    console.log(backend, JSON.stringify(measurements))
  } catch (error) {
    console.log(backend, 'unavailable:', await page?.locator('#status').textContent(), error.message)
  } finally { await browser.close() }
}