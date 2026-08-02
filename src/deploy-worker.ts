interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}

interface Environment {
  ASSETS: AssetsBinding
}

const wasmPath = '/releases/0.1.0/x2t/x2t.wasm'

export default {
  async fetch(request: Request, environment: Environment) {
    const url = new URL(request.url)
    if (url.pathname === '/editor/') {
      url.pathname = '/editor'
      return Response.redirect(url, 308)
    }
    if (url.pathname === '/' || url.pathname === '/editor') {
      url.pathname = '/index.html'
      return environment.ASSETS.fetch(new Request(url, request))
    }
    if (url.pathname !== wasmPath) return environment.ASSETS.fetch(request)
    url.pathname = `${wasmPath}.br`
    const assetHeaders = new Headers(request.headers)
    // Fetch the checked-in Brotli stream verbatim. Otherwise Static Assets may
    // Brotli-compress the .br file again when the browser advertises br support.
    assetHeaders.set('Accept-Encoding', 'identity')
    const compressed = await environment.ASSETS.fetch(new Request(url, { headers: assetHeaders, method: request.method }))
    if (!compressed.ok) return new Response('Pinned x2t WASM asset is unavailable', { status: 503 })
    const headers = new Headers(compressed.headers)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Content-Encoding', 'br')
    headers.set('Content-Type', 'application/wasm')
    headers.set('Cross-Origin-Resource-Policy', 'same-site')
    headers.set('Vary', 'Accept-Encoding')
    headers.set('X-Content-Type-Options', 'nosniff')
    return new Response(request.method === 'HEAD' ? null : compressed.body, { headers, status: compressed.status })
  },
}
