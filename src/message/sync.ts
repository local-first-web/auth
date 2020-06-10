export interface SendHashes {
  type: 'SEND_HASHES'
  payload: {
    hashes: string[]
    totalLength: number
  }
}
