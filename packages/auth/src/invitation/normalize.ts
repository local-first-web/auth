/*
 * Removes all non-alphanumeric keys from the invitation. Normalizing the key this way allows us to
 * show it to the user split into blocks (e.g. `4kgd 5mwq 5z4f mfwq`) and/or make it URL-safe (e.g.
 * `4kgd+5mwq+5z4f+mfwq`).
 */
export const normalize = (secretKey: string) => secretKey.replaceAll(/[^a-z\d]/gi, '') // Only keep alphanumeric chars
