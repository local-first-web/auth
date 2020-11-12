import { SignedLink } from '/chain'

export interface SendHashesMessage {
  type: 'SEND_HASHES'
  payload: {
    hashes: string[]
    chainLength: number
  }
}

export interface RequestLinksMessage {
  type: 'REQUEST_LINKS'
  payload: {
    startingIndex: number
  }
}

export interface SendLinksMessage {
  type: 'SEND_LINKS'
  payload: {
    startingIndex: number
    links: SignedLink<any>[]
  }
}
