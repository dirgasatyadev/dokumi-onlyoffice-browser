import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './upstream.mjs'
import { verifyLock } from './verify-lock.mjs'

const lock = await verifyLock()
const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
const outputDirectory = join(repositoryRoot, 'dist')
await mkdir(outputDirectory, { recursive: true })
await writeFile(join(outputDirectory, 'release-manifest.json'), `${JSON.stringify({
  artifactType: 'governance-scaffold',
  package: packageJson.name,
  sbom: 'sbom.cdx.json',
  upstream: lock.sources.map(({ name, commit, sha256 }) => ({ name, commit, sha256 })),
  version: packageJson.version,
}, null, 2)}\n`)
console.log('Built governance scaffold manifest. Functional editor runtime is intentionally not included in DOK-306.')
