import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/** @param {string} path */
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('pins matching editor distribution and corresponding source', async () => {
  const lock = JSON.parse(await read('editor.lock.json'))
  const { artifact } = lock
  assert.match(artifact.sourceCommit, /^[0-9a-f]{40}$/u)
  assert.ok(artifact.sourceArchiveUrl.endsWith(artifact.sourceCommit))
  assert.match(artifact.sourceArchiveSha256, /^[0-9a-f]{64}$/u)
  assert.equal(artifact.sourceArchiveBytes, 555_089_292)
  assert.equal(artifact.releaseTag, 'v9.3.0.140+0')
})

test('keeps ONLYOFFICE branding and strict bridge invariants', async () => {
  const [host, parentChannel, runtimeChannel, protocol, x2tClient] = await Promise.all([
    read('src/runtime/editor-host.ts'),
    read('src/bridge/parent-channel.ts'),
    read('src/bridge/runtime-channel.ts'),
    read('src/bridge/protocol.ts'),
    read('src/wasm/x2t-client.ts'),
  ])
  const combined = `${host}\n${parentChannel}\n${runtimeChannel}\n${protocol}`
  assert.doesNotMatch(combined, /branding\s*:\s*false/iu)
  assert.doesNotMatch(combined, /postMessage\([^\n]*['"]\*['"]/u)
  assert.match(parentChannel, /event\.source\s*!==\s*this\.#iframeWindow/u)
  assert.match(runtimeChannel, /event\.source\s*!==\s*this\.#parentWindow/u)
  assert.match(protocol, /protocolVersion === editorProtocolVersion/u)
  assert.match(x2tClient, /x2t\.wasm\?transport=br1/u)
  assert.match(host, /help:\s*true/u)
})

test('ships immutable assets and restrictive frame policy', async () => {
  const [headers, worker, wrangler] = await Promise.all([read('public/_headers'), read('src/deploy-worker.ts'), read('wrangler.jsonc')])
  assert.match(headers, /frame-ancestors 'self' https:\/\/creator\.dokumi\.id https:\/\/app\.dokumi\.id/u)
  assert.match(headers, /connect-src 'self' https:\/\/files\.dokumi\.id https:\/\/707c6104ec91159a66da339fcf6a048f\.r2\.cloudflarestorage\.com/u)
  assert.doesNotMatch(headers, /connect-src[^\n]*\*/u)
  assert.match(headers, /\/index\.html\r?\n {2}Content-Security-Policy:[^\r\n]*script-src 'self' 'unsafe-eval' blob:/u)
  assert.match(headers, /\/releases\/0\.1\.0\/onlyoffice\/\*\r?\n {2}Content-Security-Policy:[^\r\n]*script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:/u)
  assert.match(headers, /\/releases\/0\.1\.0\/onlyoffice\/\*[^]*connect-src 'self' blob:/u)
  assert.match(headers, /\/releases\/\*[\s\S]*max-age=31536000, immutable/u)
  assert.match(headers, /Content-Type: application\/wasm/u)
  assert.doesNotMatch(headers, /frame-ancestors[^\n]*\*/u)
  assert.match(wrangler, /"directory": "\.\/dist"/u)
  assert.match(worker, /Content-Encoding', 'br'/u)
  assert.match(worker, /Content-Type', 'application\/wasm'/u)
})
