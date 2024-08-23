#! /usr/bin/env ts-node

import { program } from '@commander-js/extra-typings';
import { confirm, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { mainLoop } from './mainLoop.js';
import { generateSnapshot, loadRemoteSnapshotFile, Snapshot, storeSnapshotData } from './snapshots.js';
import { loadRunData, RUN_DATA_FILENAME, RunData } from './runData.js';

export type AppSettings = {
  userCount: number
  snapshotInterval: number
  runningFromRemote?: boolean
}

const startAppFromRemote = async (): Promise<RunData> => {
  const remoteRunDataFilename = await input({
    message: "What is the location of the remote run data file?",
    default: RUN_DATA_FILENAME,
    required: true,
    validate: (remoteRunDataFilename: string) => remoteRunDataFilename != null ? true : "Must enter a remote run data filename!"
  });

  const runData = loadRunData(remoteRunDataFilename)
  runData.appSettings = {
    ...runData.appSettings,
    runningFromRemote: true
  }

  return runData
}

const startNewApp = async (): Promise<RunData> => {
  const userCount = Number(await input({
    message: "How many users do you want to spin up?",
    default: '50',
    required: true,
    validate: (userCount: string) => userCount != null && !Number.isNaN(Number(userCount)) ? true : "Must enter a valid user count!"
  }));

  const snapshotInterval = Number(await input({
    message: "At what interval of user generation should metric snapshots be generated?",
    default: '10',
    required: true,
    validate: (snapshotInterval: string) => snapshotInterval != null && !Number.isNaN(Number(snapshotInterval)) ? true : "Must enter a valid snapshot interval!"
  }));

  const appSettings = {
    userCount,
    snapshotInterval
  }

  return {
    snapshots: [],
    appSettings,
    users: [],
    teamName: 'perf-test-team',
    peerAddresses: new Set(),
    runMetadata: new Map(),
    inviteSeeds: []
  }
}

const startApp = async (): Promise<RunData> => {
  const loadRemoteRunData = await confirm({
    message: 'Would you like to start from a remote run?',
    default: false
  })

  if (loadRemoteRunData) {
    return startAppFromRemote()
  }

  return startNewApp()
}

const continueRemotely = async (runData: RunData) => {
  if (runData.appSettings.runningFromRemote) {
    storeSnapshotData(runData.snapshots, { jsonOnly: true })
    return
  }

  let continueRunning = await confirm({
    message: 'Would you like to continue running on another machine?',
    default: true
  })

  if (!continueRunning) {
    storeSnapshotData(runData.snapshots)
    return
  }

  let remoteSnapshotFilename: string
  let exit = false
  while (!exit) {
    const doneWithRemoteRun = await confirm({
      message: 'Is the remote run done?',
      default: true
    })

    if (!doneWithRemoteRun) {
      console.log(`Waiting until remote run is done!`)
      continue
    }

    remoteSnapshotFilename = await input({
      message: "Where is the remote snapshot file?",
      required: true,
      validate: (remoteSnapshotFilename: string) => remoteSnapshotFilename != null ? true : "Must enter a valid remote snapshot filename!"
    });
  }

  const remoteSnapshots = loadRemoteSnapshotFile(remoteSnapshotFilename!)
  const snapshot = await generateSnapshot(runData, remoteSnapshots)
  runData.snapshots.push(snapshot)
  storeSnapshotData(runData.snapshots, { remoteSnapshots })
}

const interactive = async () => {
  console.log(chalk.magentaBright.bold.underline("Isla Perf Test"));
  let runData: RunData | undefined
  let exit = false;
  while (!exit) {
    runData = await startApp()
    if (runData != null) {
      exit = true
    }
  };

  if (runData == null) {
    throw new Error("App hasn't been started!")
  }

  await mainLoop(runData)
  await continueRemotely(runData)
  console.log(chalk.magentaBright.bold("Goodbye!"));
  process.exit()
};

program
  .name('test-isla-perf')
  .description('Quiet Sandbox CLI')
  .version('0.0.1');

program
  .command('interactive')
  .description('Interactive mode')
  .action(() => {
    interactive();
  });

program.parse(process.argv);