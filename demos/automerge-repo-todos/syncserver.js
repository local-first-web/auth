import fs from 'node:fs'
import { LocalFirstAuthSyncServer } from '@localfirst/auth-syncserver'

const publicHost = process.env.PORTLESS_URL ? new URL(process.env.PORTLESS_URL).hostname : undefined
const storageDir = publicHost ? `.dev-sync-server-data/${publicHost}` : '.dev-sync-server-data'

const DEFAULT_PORT = 3030
const port = Number(process.env.PORT) || DEFAULT_PORT
const host = publicHost || 'localhost'

fs.mkdirSync(storageDir, { recursive: true })

const server = new LocalFirstAuthSyncServer(host)

server.listen({ port, storageDir })
