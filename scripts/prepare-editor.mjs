import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { editorExtractDirectory, loadEditorLock } from './editor-artifact.mjs'
import { repositoryRoot } from './upstream.mjs'
import { verifyEditor } from './verify-editor.mjs'

try {
  await verifyEditor()
} catch {
  await import('./fetch-editor.mjs')
  await verifyEditor()
}

const { artifact } = await loadEditorLock()
const destination = join(repositoryRoot, 'public', 'releases', '0.1.1', 'onlyoffice')
const previousDestination = join(repositoryRoot, 'public', 'releases', '0.1.0', 'onlyoffice')
await rm(previousDestination, { force: true, recursive: true })
const markerPath = join(destination, '.dokumi-integrity.json')
let prepared = false
try {
  const marker = JSON.parse(await readFile(markerPath, 'utf8'))
  prepared = marker.sha256 === artifact.sha256 && marker.sourceCommit === artifact.sourceCommit
} catch {
  // Missing or stale public assets are replaced from the verified cache.
}
if (!prepared) {
  await rm(destination, { force: true, recursive: true })
  await mkdir(destination, { recursive: true })
  await cp(editorExtractDirectory(artifact), destination, { recursive: true })
  await writeFile(markerPath, `${JSON.stringify({ sha256: artifact.sha256, sourceCommit: artifact.sourceCommit }, null, 2)}\n`)
}
// The editor registers this stable scope-relative URL, while the public
// distribution keeps the canonical worker under sdkjs/common/serviceworker.
await cp(
  join(destination, 'sdkjs', 'common', 'serviceworker', 'document_editor_service_worker.js'),
  join(destination, 'document_editor_service_worker.js'),
)
// Web Apps resolves its shared theme catalog from the distribution root.
// The pinned standalone artifact keeps the canonical file under apps/common.
await cp(
  join(destination, 'web-apps', 'apps', 'common', 'main', 'resources', 'themes', 'themes.json'),
  join(destination, 'themes.json'),
)
console.log('Prepared versioned ONLYOFFICE editor assets.')
