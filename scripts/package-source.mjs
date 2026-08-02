import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { loadEditorLock, verifyEditorSourceArchive } from './editor-artifact.mjs'
import { repositoryRoot } from './upstream.mjs'
import { verifyUpstream } from './verify-upstream.mjs'

const status = execFileSync('git', ['status', '--porcelain'], { cwd: repositoryRoot, encoding: 'utf8' })
if (status.trim()) throw new Error('Source packages must be generated from a clean Git worktree')

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
const verified = await verifyUpstream()
const { artifact: editorArtifact } = await loadEditorLock()
let editorSource
try {
  editorSource = await verifyEditorSourceArchive(editorArtifact)
} catch {
  await import('./fetch-editor-source.mjs')
  editorSource = await verifyEditorSourceArchive(editorArtifact)
}
const packageName = `${packageJson.name}-${packageJson.version}-source-${commit.slice(0, 12)}`
const stagingRoot = join(repositoryRoot, '.source-package')
const stagingDirectory = join(stagingRoot, packageName)
const repositoryDirectory = join(stagingDirectory, 'repository')
const upstreamDirectory = join(stagingDirectory, 'upstream')
const outputDirectory = join(repositoryRoot, 'dist', 'source')
const repositoryTar = join(stagingRoot, 'repository.tar')
const outputArchive = join(outputDirectory, `${packageName}.tar.gz`)

await rm(stagingRoot, { force: true, recursive: true })
await mkdir(repositoryDirectory, { recursive: true })
await mkdir(upstreamDirectory, { recursive: true })
await mkdir(outputDirectory, { recursive: true })

execFileSync('git', ['archive', '--format=tar', '--output', repositoryTar, 'HEAD'], { cwd: repositoryRoot, stdio: 'inherit' })
execFileSync('tar', ['-xf', repositoryTar, '-C', repositoryDirectory], { cwd: repositoryRoot, stdio: 'inherit' })

for (const result of verified) await copyFile(result.path, join(upstreamDirectory, basename(result.path)))
await copyFile(editorSource.archive, join(upstreamDirectory, basename(editorSource.archive)))
await writeFile(join(stagingDirectory, 'SOURCE_MANIFEST.json'), `${JSON.stringify({
  commit,
  editor: {
    bytes: editorSource.bytes,
    commit: editorArtifact.sourceCommit,
    name: editorArtifact.name,
    sha256: editorSource.sha256,
  },
  package: packageJson.name,
  upstream: verified.map(({ bytes, name, sha256 }) => ({ bytes, name, sha256 })),
  version: packageJson.version,
}, null, 2)}\n`)

execFileSync('tar', ['-czf', outputArchive, '-C', stagingRoot, packageName], { cwd: repositoryRoot, stdio: 'inherit' })
const hash = createHash('sha256')
for await (const chunk of createReadStream(outputArchive)) hash.update(chunk)
const digest = hash.digest('hex')
await writeFile(`${outputArchive}.sha256`, `${digest}  ${basename(outputArchive)}\n`)
await rm(stagingRoot, { force: true, recursive: true })
console.log(`Created ${outputArchive}`)
console.log(`SHA-256 ${digest}`)
