import { verifyArchive } from './upstream.mjs'
import { verifyLock } from './verify-lock.mjs'
import { pathToFileURL } from 'node:url'

export async function verifyUpstream() {
  const lock = await verifyLock()
  const results = []
  for (const source of lock.sources) results.push(await verifyArchive(source))
  return results
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await verifyUpstream()
  for (const result of results) console.log(`${result.name}: ${result.bytes} bytes, sha256 ${result.sha256}`)
}
