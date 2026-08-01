import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './upstream.mjs'
import { validateArtifactsLock } from './verify-artifacts.mjs'
import { validateEditorLock } from './verify-editor.mjs'
import { verifyLock } from './verify-lock.mjs'

const lock = await verifyLock()
const artifacts = await validateArtifactsLock()
const editor = await validateEditorLock()
const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
const outputDirectory = join(repositoryRoot, 'dist')
await mkdir(outputDirectory, { recursive: true })
await writeFile(join(outputDirectory, 'release-manifest.json'), `${JSON.stringify({
  artifactType: 'x2t-browser-runtime',
  browserArtifacts: artifacts.artifacts.map(({ name, releaseTag, sha256, sourceCommit }) => ({
    name,
    releaseTag,
    sha256,
    sourceCommit,
  })),
  editorArtifact: {
    name: editor.artifact.name,
    releaseTag: editor.artifact.releaseTag,
    sha256: editor.artifact.sha256,
    sourceArchiveSha256: editor.artifact.sourceArchiveSha256,
    sourceCommit: editor.artifact.sourceCommit,
  },
  package: packageJson.name,
  sbom: 'sbom.cdx.json',
  upstream: lock.sources.map(({ name, commit, sha256 }) => ({ name, commit, sha256 })),
  version: packageJson.version,
}, null, 2)}\n`)
console.log('Built x2t browser runtime release manifest.')
