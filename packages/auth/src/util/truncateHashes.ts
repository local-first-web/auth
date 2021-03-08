export const truncateHashes = (s: string) => {
  const hashRx = /(?:[A-Za-z0-9+/=]{32,100})?/g
  return s.replace(hashRx, s => s.slice(0, 5))
}
