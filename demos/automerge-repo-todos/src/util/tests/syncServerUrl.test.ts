import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('uses the named secure sync server during local development', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('SYNC_SERVER_URL', 'tofu.sync.auth.localhost')
  vi.stubGlobal('window', { location: { protocol: 'https:' } })
  const { url, wsUrl } = await import('../syncServerUrl')
  expect(url).toBe('https://tofu.sync.auth.localhost')
  expect(wsUrl).toBe('wss://tofu.sync.auth.localhost')
})
