const BASE30_ALPHABET = [...'abcdefghjkmnpqrsuvwxyz23456789']
const BASE30_LENGTH = BASE30_ALPHABET.length

export const base30 = {
  encode(bytes: Uint8Array) {
    const toLetter = (n: number) => {
      const index = Math.round(((BASE30_LENGTH - 1) * n) / 256)
      return BASE30_ALPHABET[index]
    }

    return [...bytes].map(toLetter).join('')
  },
}
