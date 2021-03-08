/*
 * Lowercases and removes all non-alphanumeric keys from the invitation. Normalizing the key this
 * way allows us to show it to the user split into blocks (e.g. `4kgd 5mwq 5z4f mfwq`) and/or make
 * it URL-safe (e.g. `4kgd+5mwq+5z4f+mfwq`).
 */
export const normalize = (secretKey: string) =>
  secretKey
    .toLowerCase() // lower case the whole key
    .replace(/[^A-Za-z0-9]/gi, '') // only keep alphanumeric chars
