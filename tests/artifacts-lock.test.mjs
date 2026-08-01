import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateArtifactsLock } from '../scripts/verify-artifacts.mjs'

describe('x2t artifact lock', () => {
  it('pins one immutable GitHub release and its browser files', async () => {
    const lock = await validateArtifactsLock()
    const artifact = lock.artifacts[0]
    assert.equal(artifact.sourceCommit, '96886ff143e05471144c4426fb304b4d794370d2')
    assert.equal(artifact.releaseTag, 'v9.3.0+0')
    assert.deepEqual(artifact.files.map(({ path }) => path).sort(), ['x2t.js', 'x2t.wasm'])
  })
})
