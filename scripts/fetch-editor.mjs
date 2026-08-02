import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import { Unzip, UnzipInflate } from 'fflate'

import { editorArchivePath, editorCacheDirectory, editorExtractDirectory, loadEditorLock, verifyEditorArchive } from './editor-artifact.mjs'
import { verifyEditor } from './verify-editor.mjs'

/** @param {string} name */
function safeEntry(name) {
  if (!name || isAbsolute(name) || name.includes('\\') || name.split('/').some((part) => part === '..')) {
    throw new Error(`Unsafe ZIP entry: ${name}`)
  }
  return name
}

/** @param {string} archive @param {string} destination */
async function extractZip(archive, destination) {
  await rm(destination, { force: true, recursive: true })
  await mkdir(destination, { recursive: true })
  /** @type {Promise<void>[]} */
  const tasks = []
  const unzip = new Unzip((file) => {
    const name = safeEntry(file.name)
    const output = resolve(destination, name)
    if (output !== destination && !output.startsWith(`${resolve(destination)}${sep}`)) throw new Error(`ZIP entry escaped destination: ${name}`)
    if (name.endsWith('/')) {
      tasks.push(mkdir(output, { recursive: true }).then(() => undefined))
      return
    }
    let chain = mkdir(dirname(output), { recursive: true }).then(() => open(output, 'wx'))
    const task = new Promise((resolveTask, rejectTask) => {
      file.ondata = (error, chunk, final) => {
        if (error) {
          rejectTask(error)
          return
        }
        chain = chain.then(async (handle) => {
          await handle.write(chunk)
          if (final) await handle.close()
          return handle
        })
        if (final) chain.then(() => resolveTask(undefined), rejectTask)
      }
      file.start()
    })
    tasks.push(task)
  })
  unzip.register(UnzipInflate)
  for await (const chunk of createReadStream(archive)) unzip.push(new Uint8Array(chunk), false)
  unzip.push(new Uint8Array(), true)
  await Promise.all(tasks)
}

/** @param {string} url @param {string} destination */
async function download(url, destination) {
  const partial = `${destination}.part`
  await rm(partial, { force: true })
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`Editor download failed: HTTP ${response.status}`)
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
const archive = editorArchivePath(artifact)
try {
  await verifyEditorArchive(artifact)
} catch {
  console.log(`Downloading pinned ${artifact.name} (${artifact.archiveBytes} bytes)...`)
  await rm(archive, { force: true })
  await download(artifact.downloadUrl, archive)
  await verifyEditorArchive(artifact)
}
const destination = editorExtractDirectory(artifact)
await extractZip(archive, destination)
await writeFile(join(destination, '.dokumi-integrity.json'), `${JSON.stringify({
  archive: relative(editorCacheDirectory, archive).replaceAll('\\', '/'),
  sha256: artifact.sha256,
  sourceCommit: artifact.sourceCommit,
}, null, 2)}\n`)
await verifyEditor()
console.log('Pinned browser editor distribution is extracted and verified.')
