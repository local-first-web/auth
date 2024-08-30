import { PeerRunMetadataMap, Snapshot } from './snapshots.js'
import { AppSettings } from './index.js'
import { Networking } from '../../network.js'

import * as fs from 'fs'
import * as path from 'path'
import { createLogger } from './logger.js'

const LOGGER = createLogger("runData")

export type RunData = {
  snapshots: Snapshot[]
  appSettings: AppSettings
  users: Networking[]
  remoteUserNames?: string[]
  teamName: string
  peerAddresses: Set<string>
  runMetadata: PeerRunMetadataMap
  inviteSeeds: string[]
}

export type TruncatedRunData = {
  appSettings: AppSettings
  usernames: string[]
  remoteUserNames?: string[]
  teamName: string
  peerAddresses: string[]
  inviteSeeds: string[]
}

function truncateRunData(runData: RunData): TruncatedRunData {
  return {
    appSettings: runData.appSettings,
    teamName: runData.teamName,
    peerAddresses: Array.from(runData.peerAddresses),
    remoteUserNames: runData.remoteUserNames,
    usernames: runData.users.map(user => user.storage.getContext()!.user.userName),
    inviteSeeds: runData.inviteSeeds
  }
}

function runDataFromTruncated(truncatedData: TruncatedRunData): RunData {
  return {
    snapshots: [],
    users: [],
    runMetadata: new Map(),
    appSettings: truncatedData.appSettings,
    teamName: truncatedData.teamName,
    peerAddresses: new Set(truncatedData.peerAddresses),
    remoteUserNames: truncatedData.usernames,
    inviteSeeds: truncatedData.inviteSeeds
  }
}

export const RUN_DATA_FILENAME = './src/scripts/isla-perf/run_data.json'

export function storeRunData(runData: RunData) {
  LOGGER.info(`Storing run data to file ${RUN_DATA_FILENAME}`)

  const data = JSON.stringify(truncateRunData(runData), null, 2)  
  fs.rmSync(RUN_DATA_FILENAME, { force: true })
  fs.writeFileSync(path.join(RUN_DATA_FILENAME), data, { encoding: 'utf-8' })
}

export function loadRunData(filename?: string): RunData {
  const actualFilename = filename || RUN_DATA_FILENAME
  LOGGER.info(`Loading run data from file ${actualFilename}`)
  
  const dataString = fs.readFileSync(actualFilename, { encoding: 'utf-8' }).toString()
  const truncatedData = JSON.parse(dataString) as TruncatedRunData
  return runDataFromTruncated(truncatedData)
}