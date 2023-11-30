/* eslint-disable @typescript-eslint/naming-convention */

import { type PeerId, Repo } from '@automerge/automerge-repo'
import { MessageChannelNetworkAdapter } from '@automerge/automerge-repo-network-messagechannel'
import { NodeFSStorageAdapter } from '@automerge/automerge-repo-storage-nodefs'
import * as Auth from '@localfirst/auth'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { rimraf } from 'rimraf'
import { AuthProvider } from '../../index.js'

export const setup = <T extends string>(userNames = ['alice', 'bob', 'charlie'] as T[]) => {
  // get all possible pairs
  type Pair = [userA: string, userB: string]
  const pairs = userNames.reduce<Pair[]>((result, userA, i) => {
    const newPairs = userNames.slice(i + 1).map(userB => [userA, userB]) as Pair[]
    return [...result, ...newPairs]
  }, [])

  // create a channel for each pair & collect all the ports
  const portsByUser = pairs.reduce<Record<string, MessagePort[]>>((result, [userA, userB]) => {
    const channel = new MessageChannel()
    const { port1: a_b, port2: b_a } = channel
    return {
      ...result,
      [userA]: [...(result[userA] ?? []), a_b], // ports for user a
      [userB]: [...(result[userB] ?? []), b_a], // ports for user b
    }
  }, {})

  const allPorts = Object.values(portsByUser).flat()

  const users = userNames.reduce<Record<string, UserStuff>>((result, userName) => {
    const storageDir = getStorageDirectory(userName)

    const setupRepo = (ports: MessagePort[]) => {
      const storage = new NodeFSStorageAdapter(storageDir)
      const authProvider = new AuthProvider({ user, device, storage })

      const repo = new Repo({
        peerId: device.deviceId as PeerId,
        network: ports.map(port => {
          const adapter = new MessageChannelNetworkAdapter(port)
          return authProvider.wrap(adapter)
        }),
        storage,
      })
      return { authProvider, repo }
    }

    const user = Auth.createUser(userName)
    const { userId } = user
    const device = Auth.createDevice(userId, `${userName}'s device`)
    const context = { user, device }
    const { authProvider, repo } = setupRepo(portsByUser[userName])

    const restart = (ports: MessagePort[]) => {
      const { authProvider, repo } = setupRepo(ports)
      return { user, device, context, authProvider, repo, restart }
    }

    return {
      ...result,
      [userName]: { user, device, context, authProvider, repo, restart },
    }
  }, {})

  const teardown = () => {
    // close network ports
    for (const port of allPorts) port.close()

    // clear storage directories
    for (const userName of userNames) {
      rimraf.sync(getStorageDirectory(userName))
    }
  }

  return { users, teardown }
}

export const getStorageDirectory = (userName: string) =>
  fs.mkdtempSync(path.join(os.tmpdir(), `automerge-repo-tests-${userName}-`))

export type TestDoc = {
  foo: string
}

export type UserStuff = {
  user: Auth.UserWithSecrets
  device: Auth.DeviceWithSecrets
  context: {
    user: Auth.UserWithSecrets
    device: Auth.DeviceWithSecrets
  }
  authProvider: AuthProvider
  repo: Repo
  restart: (ports: MessagePort[]) => UserStuff
}
