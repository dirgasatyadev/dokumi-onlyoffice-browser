import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { archivePath, upstreamCacheDirectory, verifyArchive } from './upstream.mjs'
import { verifyLock } from './verify-lock.mjs'

const lock = await verifyLock()
await mkdir(upstreamCacheDirectory, { recursive: true })

for (const source of lock.sources) {
  const target = archivePath(source)
  try {
    await verifyArchive(source)
    console.log(`${source.name}: using verified cache`)
    continue
  } catch {
    // Missing or invalid cache entries are replaced from the immutable URL.
  }

  const partial = `${target}.part`
  await rm(partial, { force: true })
  console.log(`${source.name}: downloading ${source.archiveUrl}`)
  const response = await fetch(source.archiveUrl, { redirect: 'follow', signal: AbortSignal.timeout(15 * 60_000) })
  if (!response.ok || !response.body) throw new Error(`${source.name}: download failed with HTTP ${response.status}`)

  try {
    await pipeline(response.body, createWriteStream(partial, { flags: 'wx' }))
    await verifyArchive({ ...source, archiveFile: `${source.archiveFile}.part` })
    await rm(target, { force: true })
    await rename(partial, target)
    console.log(`${source.name}: downloaded and verified`)
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
}
