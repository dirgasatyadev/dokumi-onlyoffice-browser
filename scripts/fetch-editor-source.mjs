import { mkdir, open, rename, rm } from 'node:fs/promises'

import { editorCacheDirectory, editorSourceArchivePath, loadEditorLock, verifyEditorSourceArchive } from './editor-artifact.mjs'

/** @param {string} url @param {string} destination */
async function download(url, destination) {
  const partial = `${destination}.part`
  await rm(partial, { force: true })
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`Editor source download failed: HTTP ${response.status}`)
  const handle = await open(partial, 'wx')
  try {
    for await (const chunk of response.body) await handle.write(chunk)
  } finally {
    await handle.close()
  }
  await rename(partial, destination)
}

await mkdir(editorCacheDirectory, { recursive: true })
const { artifact } = await loadEditorLock()
const archive = editorSourceArchivePath(artifact)
try {
  await verifyEditorSourceArchive(artifact)
} catch {
  console.log(`Downloading pinned ${artifact.name} corresponding source (${artifact.sourceArchiveBytes} bytes)...`)
  await rm(archive, { force: true })
  await download(artifact.sourceArchiveUrl, archive)
  await verifyEditorSourceArchive(artifact)
}
console.log('Pinned browser editor corresponding source is verified.')
