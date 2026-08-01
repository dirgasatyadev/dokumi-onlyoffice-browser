import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from './upstream.mjs'
import { verifyLock } from './verify-lock.mjs'
import { validateArtifactsLock } from './verify-artifacts.mjs'

const lock = await verifyLock()
const artifactLock = await validateArtifactsLock()
const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
const outputDirectory = join(repositoryRoot, 'dist')

const components = [
  ...Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)).map(([name, version]) => ({
    type: 'library',
    name,
    version,
    purl: `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    scope: 'excluded',
  })),
  ...lock.sources.map((source) => ({
    type: 'library',
    name: source.name,
    version: source.commit,
    hashes: [{ alg: 'SHA-256', content: source.sha256 }],
    licenses: [{ license: { id: 'AGPL-3.0-only' } }],
    externalReferences: [
      { type: 'vcs', url: source.repository },
      { type: 'distribution', url: source.archiveUrl },
    ],
  })),
  ...artifactLock.artifacts.map((artifact) => ({
    type: 'file',
    name: artifact.name,
    version: artifact.releaseTag,
    hashes: [{ alg: 'SHA-256', content: artifact.sha256 }],
    licenses: [{ license: { id: 'AGPL-3.0-only' } }],
    externalReferences: [
      { type: 'vcs', url: `${artifact.sourceRepository}#${artifact.sourceCommit}` },
      { type: 'distribution', url: artifact.downloadUrl },
    ],
  })),
]

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: packageJson.name,
      version: packageJson.version,
      licenses: [{ license: { id: packageJson.license } }],
    },
    tools: {
      components: [{ type: 'application', name: 'dokumi-sbom-generator', version: packageJson.version }],
    },
  },
  components,
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(join(outputDirectory, 'sbom.cdx.json'), `${JSON.stringify(sbom, null, 2)}\n`)
console.log(`Generated CycloneDX SBOM with ${components.length} components.`)
