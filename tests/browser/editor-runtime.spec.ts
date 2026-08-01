import { createHash } from 'node:crypto'

import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

import { createGoldenDocx } from './fixture'

const sourceUrl = 'https://files.example.test/source.docx'

function checksum(source: Uint8Array) {
  return createHash('sha256').update(source).digest('base64')
}

test('opens, edits, saves, and recovers through the strict parent bridge', async ({ browserName, page }) => {
  test.skip(browserName !== 'chromium', 'Full editor interaction runs in the minimum Chromium gate')
  test.setTimeout(180_000)
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push(`[console:${message.type()}] ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => browserErrors.push(`[pageerror] ${error.message}`))
  const source = createGoldenDocx()
  await page.route(sourceUrl, (route) => route.fulfill({
    body: Buffer.from(source),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    headers: { 'Access-Control-Allow-Origin': '*' },
  }))
  await page.goto('/tests/browser/parent.html')
  await expect(page.locator('#state')).toHaveAttribute('data-type', 'DOKUMI_EDITOR_READY', { timeout: 30_000 })
  await page.evaluate(({ checksumSha256, contentLength }) => {
    window.__dokumiParentHarness.initialize({
      document: {
        checksumSha256,
        contentLength,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        downloadUrl: 'https://files.example.test/source.docx',
        fileId: '44444444-4444-4444-8444-444444444444',
        fileName: 'golden.docx',
        sourceRevision: 1,
      },
      editorOrigin: location.origin,
      editorUrl: `${location.origin}/editor`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      sessionId: window.__dokumiParentHarness.sessionId,
      token: 'editor-purpose-test-token',
    })
  }, { checksumSha256: checksum(source), contentLength: source.byteLength })

  try {
    await expect.poll(async () => {
      const messages = await page.evaluate(() => window.__dokumiParentHarness.messages)
      const last = messages.at(-1)
      if (last?.type === 'DOKUMI_EDITOR_ERROR') {
        throw new Error(`Editor failed: ${JSON.stringify(last)}\n${browserErrors.join('\n')}`)
      }
      return last?.type
    }, { timeout: 30_000 }).toBe('DOKUMI_EDITOR_OPENED')
  } catch (error) {
    const editorFrame = page.frames().find((frame) => frame.name() === 'frameEditor')
    const diagnostics = editorFrame ? await editorFrame.evaluate(() => {
      const editor = (window as Window & { editor?: Record<string, unknown> }).editor
      return {
        bodyText: document.body.innerText.slice(-500),
        hasNativeFile: typeof editor?.asc_nativeGetFile === 'function',
        isDocumentLoadComplete: editor?.isDocumentLoadComplete,
        isLoadFullApi: editor?.isLoadFullApi,
      }
    }) : { editorFrame: false }
    throw new Error(`${String(error)}\nDiagnostics: ${JSON.stringify(diagnostics)}\n${browserErrors.join('\n')}`)
  }
  const runtime = page.frameLocator('#runtime')
  const editor = runtime.frameLocator('iframe[name="frameEditor"]')
  await expect(editor.locator('body')).toBeVisible()
  await expect(runtime.getByRole('link', { name: 'ONLYOFFICE source · AGPLv3' })).toHaveAttribute('href', /fc09b218064061b6deaea206c068b34e5a20bd39/u)

  const canvas = editor.locator('#id_viewer_overlay')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } })
  await page.keyboard.type(' DOKUMI_EDIT_308 ')
  const beforeSave = await page.evaluate(() => window.__dokumiParentHarness.messages.length)
  await page.evaluate(() => window.__dokumiParentHarness.save())
  await expect.poll(async () => {
    const recent = await page.evaluate((start) => window.__dokumiParentHarness.messages.slice(start), beforeSave)
    const failure = recent.find((message) => message.type === 'DOKUMI_EDITOR_ERROR')
    if (failure) throw new Error(`Save failed: ${JSON.stringify(failure)}`)
    const last = recent.at(-1)
    return last?.type
  }, { timeout: 60_000 }).toBe('DOKUMI_EDITOR_SAVED')

  const recovered = await page.evaluate(async () => {
    const snapshot = await window.__dokumiParentHarness.loadRecovery()
    return snapshot ? {
      baseRevision: snapshot.baseRevision,
      docx: Array.from(new Uint8Array(snapshot.docx ?? new ArrayBuffer(0))),
      pendingUpload: snapshot.pendingUpload,
    } : null
  })
  expect(recovered).toMatchObject({ baseRevision: 1, pendingUpload: true })
  const output = unzipSync(Uint8Array.from(recovered!.docx))
  const xml = new TextDecoder().decode(output['word/document.xml'])
  expect(xml).toContain('DOKUMI_EDIT_308')

  await runtime.locator('body').evaluate(() => location.reload())
  await expect(page.locator('#state')).toHaveAttribute('data-type', 'DOKUMI_EDITOR_READY', { timeout: 60_000 })
  const beforeRecovery = await page.evaluate(() => window.__dokumiParentHarness.messages.length)
  await page.evaluate(({ checksumSha256, contentLength }) => {
    window.__dokumiParentHarness.initialize({
      document: {
        checksumSha256,
        contentLength,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        downloadUrl: 'https://files.example.test/source.docx',
        fileId: '44444444-4444-4444-8444-444444444444',
        fileName: 'golden.docx',
        sourceRevision: 1,
      },
      editorOrigin: location.origin,
      editorUrl: `${location.origin}/editor`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      sessionId: window.__dokumiParentHarness.sessionId,
      token: 'editor-purpose-test-token-recovered',
    })
  }, { checksumSha256: checksum(source), contentLength: source.byteLength })
  await expect.poll(async () => {
    const recent = await page.evaluate((start) => window.__dokumiParentHarness.messages.slice(start), beforeRecovery)
    const failure = recent.find((message) => message.type === 'DOKUMI_EDITOR_ERROR')
    if (failure) throw new Error(`Recovery failed: ${JSON.stringify(failure)}`)
    return recent.find((message) => message.type === 'DOKUMI_EDITOR_OPENED')
  }, { timeout: 60_000 }).toMatchObject({ payload: { baseRevision: 1, recovered: true } })
})

test('rejects invalid bridge envelopes and keeps session isolation', async ({ page }) => {
  await page.goto('/tests/browser/parent.html')
  await expect(page.locator('#state')).toHaveAttribute('data-type', 'DOKUMI_EDITOR_READY')
  const before = await page.evaluate(() => window.__dokumiParentHarness.messages.length)
  await page.frameLocator('#runtime').locator('body').evaluate(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        payload: { accessToken: 'business-token-must-not-pass' },
        protocolVersion: 1,
        requestId: crypto.randomUUID(),
        sessionId: '11111111-1111-4111-8111-111111111111',
        type: 'DOKUMI_EDITOR_INIT',
      },
      origin: 'https://evil.example',
      source: window.parent,
    }))
  })
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => window.__dokumiParentHarness.messages.length)).toBe(before)
})
