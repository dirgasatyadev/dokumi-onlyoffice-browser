/// <reference lib="webworker" />

import type {
  X2tFailure,
  X2tMediaFile,
  X2tPhase,
  X2tTimings,
  X2tWorkerRequest,
  X2tWorkerResponse,
} from './types'

interface EmscriptenFs {
  analyzePath(path: string): { exists: boolean }
  mkdir(path: string): void
  readdir(path: string): string[]
  readFile(path: string, options?: { encoding?: 'binary' }): Uint8Array
  rmdir(path: string): void
  stat(path: string): { mode: number }
  unlink(path: string): void
  writeFile(path: string, data: string | Uint8Array): void
}

interface X2tModule {
  FS: EmscriptenFs
  ccall(name: string, returnType: 'number', argumentTypes: ['string'], arguments_: [string]): number
}

interface ModuleOptions {
  onAbort?: (reason: unknown) => void
  onRuntimeInitialized?: () => void
  wasmBinary?: Uint8Array
}

declare const Module: X2tModule
declare const HEAPU8: Uint8Array

const worker = self as DedicatedWorkerGlobalScope & typeof globalThis
let runtimePromise: Promise<X2tModule> | undefined

function transferBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

function mkdir(path: string) {
  if (!Module.FS.analyzePath(path).exists) Module.FS.mkdir(path)
}

function removeTree(path: string) {
  if (!Module.FS.analyzePath(path).exists) return
  for (const entry of Module.FS.readdir(path)) {
    if (entry === '.' || entry === '..') continue
    const child = `${path}/${entry}`
    if ((Module.FS.stat(child).mode & 0o170000) === 0o040000) removeTree(child)
    else Module.FS.unlink(child)
  }
  Module.FS.rmdir(path)
}

function resetWorkingDirectory() {
  cleanupWorkingDirectory()
  mkdir('/tmp')
  mkdir('/working')
  mkdir('/working/media')
  mkdir('/working/fonts')
  mkdir('/working/themes')
}

function cleanupWorkingDirectory() {
  removeTree('/working')
  removeTree('/tmp')
}

function cleanupVerified() {
  return !Module.FS.analyzePath('/working').exists && !Module.FS.analyzePath('/tmp').exists
}

function safeMediaPath(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '')
  if (!normalized || normalized.includes('..') || normalized.split('/').some((part) => !part)) {
    throw new Error(`Unsafe media path: ${path}`)
  }
  return normalized
}

function writeMedia(media: X2tMediaFile[]) {
  for (const item of media) {
    const relative = safeMediaPath(item.path)
    const parts = relative.split('/')
    let parent = '/working/media'
    for (const part of parts.slice(0, -1)) {
      parent = `${parent}/${part}`
      mkdir(parent)
    }
    Module.FS.writeFile(`${parent}/${parts.at(-1)}`, new Uint8Array(item.data))
  }
}

function readMedia(path = '/working/media', prefix = ''): X2tMediaFile[] {
  const output: X2tMediaFile[] = []
  for (const entry of Module.FS.readdir(path).sort()) {
    if (entry === '.' || entry === '..') continue
    const child = `${path}/${entry}`
    const relative = prefix ? `${prefix}/${entry}` : entry
    if ((Module.FS.stat(child).mode & 0o170000) === 0o040000) output.push(...readMedia(child, relative))
    else output.push({ data: transferBuffer(Module.FS.readFile(child, { encoding: 'binary' })), path: relative })
  }
  return output
}

function parameters(input: string, output: string) {
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
    `<m_sFontDir>/working/fonts/</m_sFontDir><m_sThemeDir>/working/themes</m_sThemeDir>` +
    `<m_sFileFrom>${input}</m_sFileFrom><m_sFileTo>${output}</m_sFileTo>` +
    `<m_bIsNoBase64>false</m_bIsNoBase64><m_nCsvTxtEncoding>46</m_nCsvTxtEncoding>` +
    `<m_nCsvDelimiter>4</m_nCsvDelimiter></TaskQueueDataConvert>`
}

function timings(startedAt: number): X2tTimings {
  const finishedAt = performance.now()
  return { durationMs: finishedAt - startedAt, finishedAt, startedAt, wasmMemoryBytes: HEAPU8.byteLength }
}

function convert(inputPath: string, input: ArrayBuffer, outputPath: string, media: X2tMediaFile[] = []) {
  resetWorkingDirectory()
  try {
    Module.FS.writeFile(inputPath, new Uint8Array(input))
    writeMedia(media)
    Module.FS.writeFile('/working/params.xml', parameters(inputPath, outputPath))
    const exitCode = Module.ccall('main1', 'number', ['string'], ['/working/params.xml'])
    if (exitCode !== 0) {
      const error = new Error(`x2t exited with code ${exitCode}`) as Error & { exitCode: number }
      error.exitCode = exitCode
      throw error
    }
    return transferBuffer(Module.FS.readFile(outputPath, { encoding: 'binary' }))
  } catch (error) {
    throw error
  }
}

async function initialize(jsUrl: string, wasmUrl: string) {
  if (runtimePromise) return runtimePromise
  runtimePromise = new Promise<X2tModule>(async (resolve, reject) => {
    try {
      const response = await fetch(wasmUrl)
      if (!response.ok) throw new Error(`Unable to fetch x2t.wasm: HTTP ${response.status}`)
      const options: ModuleOptions = {
        onAbort: (reason) => reject(new Error(`x2t initialization aborted: ${String(reason)}`)),
        onRuntimeInitialized: () => resolve(Module),
        wasmBinary: new Uint8Array(await response.arrayBuffer()),
      }
      Object.assign(globalThis, { Module: options })
      importScripts(jsUrl)
    } catch (error) {
      runtimePromise = undefined
      reject(error)
    }
  })
  return runtimePromise
}

function failure(error: unknown, phase: X2tPhase): X2tFailure {
  const value = error as { exitCode?: number; message?: string }
  return {
    code: phase === 'initialize' ? 'INITIALIZATION_FAILED' : 'CONVERSION_FAILED',
    ...(typeof value?.exitCode === 'number' ? { exitCode: value.exitCode } : {}),
    message: value?.message ?? String(error),
    phase,
  }
}

function post(response: X2tWorkerResponse, transfer: Transferable[] = []) {
  worker.postMessage(response, transfer)
}

worker.onmessage = async ({ data }: MessageEvent<X2tWorkerRequest>) => {
  const phase: X2tPhase = data.kind === 'initialize' ? 'initialize' : data.kind
  try {
    if (data.kind === 'initialize') {
      await initialize(data.jsUrl, data.wasmUrl)
      post({ id: data.id, kind: 'ready' })
      return
    }
    if (!runtimePromise) throw new Error('x2t worker has not been initialized')
    await runtimePromise
    const startedAt = performance.now()
    if (data.kind === 'open-docx') {
      const editorBin = convert('/working/input.docx', data.docx, '/working/output.bin')
      const media = readMedia()
      const conversionTimings = timings(startedAt)
      cleanupWorkingDirectory()
      post(
        { id: data.id, kind: 'open-docx-result', result: { cleanupVerified: cleanupVerified(), editorBin, media, timings: conversionTimings } },
        [editorBin, ...media.map((item) => item.data)],
      )
      return
    }
    const docx = convert('/working/input.bin', data.editorBin, '/working/output.docx', data.media)
    const conversionTimings = timings(startedAt)
    cleanupWorkingDirectory()
    post({ id: data.id, kind: 'export-docx-result', result: { cleanupVerified: cleanupVerified(), docx, timings: conversionTimings } }, [docx])
  } catch (error) {
    post({ error: failure(error, phase), id: data.id, kind: 'error' })
  } finally {
    if (data.kind !== 'initialize' && runtimePromise) cleanupWorkingDirectory()
  }
}
