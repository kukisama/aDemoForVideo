import { defineConfig, type Plugin } from 'vite'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'

// Only inline this build's exact bundle entries; no glob parser or extra dependency.
function standaloneFilm(): Plugin {
  return {
    name: 'genesis-standalone', apply: 'build', enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['index.html']
      if (!page || page.type !== 'asset') throw new Error('Missing generated HTML')
      let html = String(page.source)
      html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g, (_tag, path: string) => {
        const name = path.replace(/^\.?\//, '')
        const script = bundle[name]
        if (!script || script.type !== 'chunk') throw new Error(`Missing script ${name}`)
        delete bundle[name]
        return `<script type="module">${script.code.replaceAll('</script', '<\\/script')}</script>`
      })
      html = html.replace(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/g, (_tag, path: string) => {
        const name = path.replace(/^\.?\//, '')
        const style = bundle[name]
        if (!style || style.type !== 'asset') throw new Error(`Missing stylesheet ${name}`)
        delete bundle[name]
        return `<style>${String(style.source).replaceAll('</style', '<\\/style')}</style>`
      })
      page.source = html
    },
    closeBundle() {
      const destination = new URL('../export/一念万物/', import.meta.url)
      mkdirSync(destination, { recursive: true })
      copyFileSync(new URL('./dist/index.html', import.meta.url), new URL('GENESIS.html', destination))
    },
  }
}

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [standaloneFilm()],
  define: {
    __SCORE_URL__: JSON.stringify(command === 'build'
      ? `data:audio/wav;base64,${readFileSync(new URL('./public/audio/score.wav', import.meta.url)).toString('base64')}`
      : '/audio/score.wav'),
  },
  build: { copyPublicDir: false, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false },
}))