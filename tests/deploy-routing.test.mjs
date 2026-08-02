import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/** @param {string} path */
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('routes editor HTML through the Worker without static asset redirects', async () => {
  const [worker, wrangler] = await Promise.all([
    read('src/deploy-worker.ts'),
    read('wrangler.jsonc'),
  ])
  assert.match(worker, /url\.pathname === '\/' \|\| url\.pathname === '\/editor'/u)
  assert.match(worker, /url\.pathname = '\/index\.html'/u)
  assert.match(worker, /url\.pathname = `\$\{wasmPath\}\.bin`/u)
  assert.match(worker, /encodeBody: 'manual'/u)
  assert.match(wrangler, /"html_handling": "none"/u)
  assert.match(wrangler, /"run_worker_first": true/u)
})
