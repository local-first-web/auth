#! /usr/bin/env ts-node

import chalk from 'chalk';

import { Libp2pService, Networking } from '../network.js';
import { Peer } from '@libp2p/interface';
import actionSelect from '../components/actionSelect.js';
import clipboard from 'clipboardy';

const displayMyInfo = async (networking: Networking) => {
  const context = networking.libp2p.storage.getContext()!

  console.log("--------------------");
  console.log("User Information");
  console.log("--------------------");
  console.log("Name:", context.user.userName);
  console.log("ID:", context.user.userId);
  console.log("\n")
  console.log(chalk.bold("-- Device --"));
  console.log("Name:", context.device.deviceName)
  console.log("ID:", context.device.deviceId)
  console.log("\n");

  console.log("--------------------");
  console.log("Libp2p Information");
  console.log("--------------------");
  console.log(chalk.bold("Me"))
  console.log("Peer ID:", await networking.libp2p.getPeerId())
  console.log("\n")
  console.log(chalk.bold("-- Addresses --"))
  console.table(networking.libp2p.libp2p!.getMultiaddrs().map((addr) => addr.toString()));
  console.log("\n")
  console.log(chalk.bold("Connected Peers"))
  const connectedPeerIds = networking.libp2p.libp2p!.getPeers()
  const allPeers: { [id: string]: Peer } = {};
  (await networking.libp2p.libp2p!.peerStore.all()).forEach((peer: Peer) => allPeers[peer.id.toString()] = peer)
  const connectedPeers: Peer[] = []
  for (const peerId of connectedPeerIds) {
    connectedPeers.push(allPeers[peerId.toString()])
  }
  console.table(connectedPeers)
  console.log("\n")
}

const me = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper")
    return
  }

  let exit = false;
  while (exit === false) {
    const context = networking.libp2p.storage.getContext()!

    const answer = await actionSelect({
      message: "Select an invite",
      choices: [{
        name: context.user.userName,
        value: context.user.userName
      }],
      actions: [
        { name: "Show Info", value: "show", key: "s" },
        { name: "Back", value: "back", key: "q" },
        { name: "Copy Address", value: "copyAddr", key: "c" },
      ],
    });

    switch (answer.action) {
      case "show":
      case undefined:
        await displayMyInfo(networking)
        break;
      case "copyAddr":
        const addr = networking.libp2p.libp2p.getMultiaddrs()[0].toString().split('/p2p')[0]
        console.log(`Copying my libp2p address (${addr}) to clipboard`);
        await clipboard.write(addr)
        if (await clipboard.read() === addr) {
          console.log('Copied!')
        } else {
          console.warn('Copy failed!')
        }
        break;
      case "back":
        exit = true;
        return;
    };
  }
}



export {
  me,
}
