import { Keyset, KeysetWithSecrets } from 'crdx'

export type ServerWithSecrets = {
  url: Url
  keys: KeysetWithSecrets
}

export type Server = {
  url: Url
  keys: Keyset
}

export type Url = string
