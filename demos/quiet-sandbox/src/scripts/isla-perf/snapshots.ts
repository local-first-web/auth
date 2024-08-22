import { sleep } from "../../utils/utils.js"

import * as fs from 'fs'
import { RunData } from "./runData.js"

export type PeerRunMetadata = {
  chainLoadTimeMs: number
  memberCount: number
  memberDiff: number
  deviceCount: number
  deviceDiff: number
  connectedPeers: number
}

export type PeerRunMetadataMap = Map<string, PeerRunMetadata>

export type Diff = {
  username: string
  diff: number
}

export type DiffMeta = {
  count: number
  avg: number
}

export type ConnectedPeers = {
  username: string
  connectedPeers: number
}

export type Snapshot = {
  userCount: number
  avgChainLoadTimeMs: number
  memberDiffMeta: DiffMeta
  deviceDiffMeta: DiffMeta
  memberDiffs: Diff[]
  deviceDiffs: Diff[]
  avgConnectedPeers: number
  connectedPeers: ConnectedPeers[]
}

export async function generateSnapshot(runData: RunData): Promise<Snapshot> {
  const totalUsers = runData.users.length + (runData.remoteUserNames?.length || 0)
  console.log(`Capturing snapshot at ${totalUsers} users`)
  const expectedDeviceCount = totalUsers * 2 - 1 - (runData.remoteUserNames != null ? 1 : 0)
  const memberDiffs: Diff[] = []
  const deviceDiffs: Diff[] = []
  const connectedPeersList: ConnectedPeers[] = []

  let sumChainLoadTimeMs = 0
  let sumMemberDiff = 0
  let sumDeviceDiff = 0
  let sumConnectedPeers = 0

  await sleep(5000)
  for (const user of runData.users) {
    const username = user.storage.getContext()!.user.userName
    console.log(`Generating snapshot for user ${username}`)
    const members = user.storage.getSigChain()!.users.getAllMembers()
    const memberCount = members.length
    const memberDiff = totalUsers - memberCount
    if (memberDiff > 0) {
      memberDiffs.push({
        username,
        diff: memberDiff
      })
      sumMemberDiff += memberDiff
    }

    let deviceCount = 0
    for (const member of members) {
      deviceCount += member.devices?.length || 0
    }
    const deviceDiff = expectedDeviceCount - deviceCount
    if (deviceDiff > 0) {
      deviceDiffs.push({
        username,
        diff: deviceDiff
      })
      sumDeviceDiff += deviceDiff
    }
    const connectedPeers = user.libp2p.libp2p!.getPeers().length
    const existingMetadata = runData.runMetadata.get(username)!
    runData.runMetadata.set(username, {
      ...existingMetadata,
      memberCount,
      memberDiff,
      deviceCount,
      deviceDiff,
      connectedPeers
    })
    sumChainLoadTimeMs += existingMetadata.chainLoadTimeMs
    sumConnectedPeers += connectedPeers
    connectedPeersList.push({ username, connectedPeers })
  }
  const snapshot: Snapshot = {
    userCount: totalUsers,
    avgChainLoadTimeMs: sumChainLoadTimeMs / runData.users.length,
    memberDiffs,
    deviceDiffs,
    memberDiffMeta: {
      count: memberDiffs.length,
      avg: sumMemberDiff / memberDiffs.length || 0
    },
    deviceDiffMeta: {
      count: deviceDiffs.length,
      avg: sumDeviceDiff / deviceDiffs.length || 0
    },
    avgConnectedPeers: sumConnectedPeers / runData.users.length,
    connectedPeers: connectedPeersList
  }

  return snapshot
}

export function storeSnapshotData(snapshots: Snapshot[]) {
  const data = `const data = ${JSON.stringify(snapshots, null, 2)};`
  const filename = './src/scripts/isla-perf/data.json.js'
  console.log(`Storing snapshot data to file ${filename}`)
  
  fs.rmSync(filename, { force: true })
  fs.writeFileSync(filename, data, { encoding: 'utf-8' })
}