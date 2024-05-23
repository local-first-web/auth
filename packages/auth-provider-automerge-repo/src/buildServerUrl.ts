/**
 * Prepends the given host with protocol if it's missing, and returns a URL object.
 */
export const buildServerUrl = (host: string) => {
  // assume http if no protocol provided (for backwards compatibility)
  if (!host.includes('//')) {
    host = `http://${host}`
  }
  return new URL(host)
}
