import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { verifyLock } from '../scripts/verify-lock.mjs'

describe('upstream lock', () => {
  it('pins the three required public upstream sources', async () => {
    const lock = await verifyLock()
    assert.deepEqual(lock.sources.map((source) => source.name), [
      'onlyoffice-sdkjs',
      'onlyoffice-web-apps',
      'onlyoffice-x2t-wasm',
    ])
  })

  it('uses immutable commits and checksums', async () => {
    const lock = await verifyLock()
    for (const source of lock.sources) {
      assert.match(source.commit, /^[0-9a-f]{40}$/u)
      assert.match(source.sha256, /^[0-9a-f]{64}$/u)
      assert.ok(source.archiveUrl.endsWith(source.commit))
    }
  })

  it('records the public CryptPad parent for the x2t fork', async () => {
    const lock = await verifyLock()
    const x2t = lock.sources.find((source) => source.name === 'onlyoffice-x2t-wasm')
    assert.equal(x2t?.repository, 'https://github.com/dirgasatyadev/onlyoffice-x2t-wasm.git')
    assert.equal(x2t?.parentRepository, 'https://github.com/cryptpad/onlyoffice-x2t-wasm.git')
  })
})
