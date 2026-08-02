import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

import { createGoldenCorpus, createGoldenDocx, createNearLimitDocx } from './fixture'

interface RoundTripResult {
  editorBinBytes: number
  exportDurationMs: number
  exportWasmMemoryBytes: number
  inputDetached: boolean
  mainThreadHeartbeats: number
  mediaPaths: string[]
  openDurationMs: number
  openWasmMemoryBytes: number
  outputBase64: string
}

async function roundTrip(page: import('@playwright/test').Page, source: Uint8Array) {
  return page.evaluate(async (sourceBase64): Promise<RoundTripResult> => {
    const X2tClient = Reflect.get(window, '__DokumiX2tClient')
    const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
    const encode = (value: ArrayBuffer) => {
      const bytes = new Uint8Array(value)
      let binary = ''
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      }
      return btoa(binary)
    }
    const client = new X2tClient({ timeoutMs: 180_000 })
    let mainThreadHeartbeats = 0
    const heartbeat = setInterval(() => mainThreadHeartbeats += 1, 10)
    try {
      const input = decode(sourceBase64).buffer
      const opened = await client.openDocx(input)
      const inputDetached = input.byteLength === 0
      const editorBinBytes = opened.editorBin.byteLength
      const mediaPaths = opened.media.map(({ path }: { path: string }) => path).sort()
      const openDurationMs = opened.timings.durationMs
      const openWasmMemoryBytes = opened.timings.wasmMemoryBytes
      if (!opened.cleanupVerified) throw new Error('Virtual filesystem cleanup failed after open')
      const exported = await client.exportDocx(opened.editorBin, opened.media)
      if (!exported.cleanupVerified) throw new Error('Virtual filesystem cleanup failed after export')
      return {
        editorBinBytes,
        exportDurationMs: exported.timings.durationMs,
        exportWasmMemoryBytes: exported.timings.wasmMemoryBytes,
        inputDetached,
        mainThreadHeartbeats,
        mediaPaths,
        openDurationMs,
        openWasmMemoryBytes,
        outputBase64: encode(exported.docx),
      }
    } finally {
      clearInterval(heartbeat)
      client.dispose()
    }
  }, Buffer.from(source).toString('base64'))
}

test('round-trips representative DOCX through Editor.bin in a worker', async ({ page }) => {
  await page.goto('/?x2t-test=1')
  const result = await roundTrip(page, createGoldenDocx())

  expect(result.inputDetached).toBe(true)
  expect(result.mainThreadHeartbeats).toBeGreaterThan(3)
  expect(result.editorBinBytes).toBeGreaterThan(0)
  expect(result.openDurationMs).toBeGreaterThan(0)
  expect(result.exportDurationMs).toBeGreaterThan(0)
  expect(result.mediaPaths.length).toBeGreaterThan(0)

  const output = unzipSync(Uint8Array.from(Buffer.from(result.outputBase64, 'base64')))
  const names = Object.keys(output)
  expect(names).toContain('[Content_Types].xml')
  expect(names).toContain('word/document.xml')
  expect(names.some((name) => name.startsWith('word/media/'))).toBe(true)
  expect(names.some((name) => name.toLowerCase().endsWith('vbaproject.bin'))).toBe(false)

  const decoder = new TextDecoder()
  const combinedXml = names.filter((name) => name.endsWith('.xml')).map((name) => decoder.decode(output[name])).join('\n')
  expect(combinedXml).toContain('{{nama_lengkap}}')
  expect(combinedXml).toContain('東京')
  expect(combinedXml).toContain('Ελληνικά')
  expect(combinedXml).toContain('Kolom A')
  expect(combinedXml).toContain('HEADER DOKUMI')
  expect(combinedXml).toContain('FOOTER 2026')

  console.log(JSON.stringify({
    editorBinBytes: result.editorBinBytes,
    exportDurationMs: Math.round(result.exportDurationMs),
    exportWasmMemoryBytes: result.exportWasmMemoryBytes,
    mediaPaths: result.mediaPaths,
    openDurationMs: Math.round(result.openDurationMs),
    openWasmMemoryBytes: result.openWasmMemoryBytes,
    outputDocxBytes: Buffer.from(result.outputBase64, 'base64').byteLength,
  }))
})

test('round-trips the 20-document MVP golden corpus without data loss', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'The full golden corpus gate runs once in Chromium')
  test.setTimeout(300_000)
  const corpus = createGoldenCorpus()
  expect(corpus).toHaveLength(20)
  await page.goto('/?x2t-test=1')
  const results = await page.evaluate(async (documents) => {
    const X2tClient = Reflect.get(window, '__DokumiX2tClient')
    const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0)).buffer
    const encode = (value: ArrayBuffer) => {
      const bytes = new Uint8Array(value)
      let binary = ''
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
      return btoa(binary)
    }
    const client = new X2tClient({ timeoutMs: 180_000 })
    try {
      const output = []
      for (const document of documents) {
        const opened = await client.openDocx(decode(document.sourceBase64))
        const exported = await client.exportDocx(opened.editorBin, opened.media)
        output.push({ cleanupVerified: opened.cleanupVerified && exported.cleanupVerified, marker: document.marker, outputBase64: encode(exported.docx) })
      }
      return output
    } finally {
      client.dispose()
    }
  }, corpus.map((document) => ({ marker: document.marker, sourceBase64: Buffer.from(document.source).toString('base64') })))
  expect(results).toHaveLength(20)
  for (const result of results) {
    expect(result.cleanupVerified).toBe(true)
    const output = unzipSync(Uint8Array.from(Buffer.from(result.outputBase64, 'base64')))
    const xml = new TextDecoder().decode(output['word/document.xml'])
    expect(xml).toContain(result.marker)
    expect(xml).toContain('{{nama_lengkap}}')
  }
})

test('round-trips a DOCX near the 50 MiB boundary and records memory', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'The near-limit performance baseline runs once in Chromium')
  test.setTimeout(300_000)
  const source = createNearLimitDocx()
  expect(source.byteLength).toBeGreaterThan(45 * 1024 * 1024)
  expect(source.byteLength).toBeLessThan(50 * 1024 * 1024)
  await page.route('**/fixtures/near-limit.docx', (route) => route.fulfill({
    body: Buffer.from(source),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }))
  await page.goto('/?x2t-test=1')
  const result = await page.evaluate(async () => {
    const X2tClient = Reflect.get(window, '__DokumiX2tClient')
    const client = new X2tClient({ timeoutMs: 240_000 })
    try {
      const input = await fetch('/fixtures/near-limit.docx').then((response) => response.arrayBuffer())
      const inputBytes = input.byteLength
      const opened = await client.openDocx(input)
      const editorBinBytes = opened.editorBin.byteLength
      const exported = await client.exportDocx(opened.editorBin, opened.media)
      return {
        cleanupVerified: opened.cleanupVerified && exported.cleanupVerified,
        editorBinBytes,
        exportDurationMs: exported.timings.durationMs,
        inputBytes,
        openDurationMs: opened.timings.durationMs,
        outputBytes: exported.docx.byteLength,
        wasmMemoryBytes: Math.max(opened.timings.wasmMemoryBytes, exported.timings.wasmMemoryBytes),
      }
    } finally {
      client.dispose()
    }
  })
  expect(result).toMatchObject({ cleanupVerified: true, inputBytes: source.byteLength })
  expect(result.editorBinBytes).toBeGreaterThan(0)
  expect(result.outputBytes).toBeGreaterThan(0)
  console.log(JSON.stringify(result))
})

test('returns a structured failure when the pinned runtime cannot initialize', async ({ page }) => {
  await page.goto('/?x2t-test=1')
  const error = await page.evaluate(async () => {
    const X2tClient = Reflect.get(window, '__DokumiX2tClient')
    const client = new X2tClient({ timeoutMs: 30_000, wasmUrl: '/missing-x2t.wasm' })
    try {
      await client.initialize()
      return null
    } catch (value) {
      return value instanceof Error
        ? { code: Reflect.get(value, 'code'), message: value.message, phase: Reflect.get(value, 'phase') }
        : { message: String(value) }
    } finally {
      client.dispose()
    }
  })
  expect(error).toMatchObject({ code: 'INITIALIZATION_FAILED', phase: 'initialize' })
})
