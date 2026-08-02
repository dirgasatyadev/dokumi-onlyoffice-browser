import { loadUpstreamLock } from './upstream.mjs'
import { pathToFileURL } from 'node:url'

const commitPattern = /^[0-9a-f]{40}$/u
const sha256Pattern = /^[0-9a-f]{64}$/u
const archiveFilePattern = /^[a-z0-9][a-z0-9.-]+\.tar\.gz$/u

export async function verifyLock() {
  const lock = await loadUpstreamLock()
  if (lock.lockVersion !== 1) throw new Error('Unsupported upstream lock version')
  if (!Array.isArray(lock.sources) || lock.sources.length === 0) throw new Error('The upstream lock must contain sources')

  const names = new Set()
  const archiveFiles = new Set()
  for (const source of lock.sources) {
    if (names.has(source.name)) throw new Error(`Duplicate upstream name: ${source.name}`)
    if (archiveFiles.has(source.archiveFile)) throw new Error(`Duplicate archive file: ${source.archiveFile}`)
    names.add(source.name)
    archiveFiles.add(source.archiveFile)

    if (!commitPattern.test(source.commit)) throw new Error(`${source.name}: commit must be a 40-character lowercase SHA`)
    if (!sha256Pattern.test(source.sha256)) throw new Error(`${source.name}: sha256 must be a lowercase SHA-256 digest`)
    if (!archiveFilePattern.test(source.archiveFile)) throw new Error(`${source.name}: unsafe archive file name`)
    if (!Number.isSafeInteger(source.archiveBytes) || source.archiveBytes <= 0) throw new Error(`${source.name}: invalid archive byte length`)

    const archiveUrl = new URL(source.archiveUrl)
    if (archiveUrl.protocol !== 'https:' || archiveUrl.hostname !== 'codeload.github.com') {
      throw new Error(`${source.name}: archive must use HTTPS codeload.github.com`)
    }
    if (!archiveUrl.pathname.endsWith(`/${source.commit}`)) throw new Error(`${source.name}: archive URL is not pinned to its commit`)

    const repository = new URL(source.repository)
    if (repository.protocol !== 'https:' || repository.hostname !== 'github.com') {
      throw new Error(`${source.name}: repository must use HTTPS github.com`)
    }
  }
  return lock
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lock = await verifyLock()
  console.log(`Verified ${lock.sources.length} immutable upstream lock entries.`)
}
