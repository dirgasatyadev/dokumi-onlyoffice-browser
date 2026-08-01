export const productionParentOrigins = new Set([
  'https://creator.dokumi.id',
  'https://app.dokumi.id',
])

export function exactOrigin(value: string) {
  const url = new URL(value)
  const loopback = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (url.origin !== value || (url.protocol !== 'https:' && !loopback)) {
    throw new Error(`Invalid exact origin: ${value}`)
  }
  return url.origin
}

export function allowedParentOrigin(value: string, additionalOrigins: ReadonlySet<string> = new Set()) {
  const origin = exactOrigin(value)
  if (!productionParentOrigins.has(origin) && !additionalOrigins.has(origin)) throw new Error(`Parent origin is not allowed: ${origin}`)
  return origin
}
