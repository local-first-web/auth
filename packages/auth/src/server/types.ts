import { Keyset, KeysetWithSecrets } from 'crdx'

export type ServerWithSecrets = {
  host: Host
  keys: KeysetWithSecrets
}

export type Server = {
  host: Host
  keys: Keyset
}

/** The hostname, possibly including a port number; e.g. `example.com`, `localhost:8080`, `188.26.221.135`  */
export type Host = string
