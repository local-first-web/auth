#! /usr/bin/env ts-node

import chalk from 'chalk';

import { Libp2pService } from '../network.js';
import { Peer } from '@libp2p/interface';
import actionSelect from '../components/actionSelect.js';
import clipboard from 'clipboardy';

const displayMyInfo = async (libp2p: Libp2pService) => {
  const context = libp2p.storage.getContext()!

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
  console.log("Peer ID:", await libp2p.getPeerId())
  console.log("\n")
  console.log(chalk.bold("-- Addresses --"))
  console.table(libp2p.libp2p!.getMultiaddrs().map((addr) => addr.toString()));
  console.log("\n")
  console.log(chalk.bold("Connected Peers"))
  const connectedPeerIds = libp2p.libp2p!.getPeers()
  const allPeers: { [id: string]: Peer } = {};
  (await libp2p.libp2p!.peerStore.all()).forEach((peer: Peer) => allPeers[peer.id.toString()] = peer)
  const connectedPeers: Peer[] = []
  for (const peerId of connectedPeerIds) {
    connectedPeers.push(allPeers[peerId.toString()])
  }
  console.table(connectedPeers)
  console.log("\n")
}

const me = async (libp2p: Libp2pService | undefined) => {
  if (libp2p == null || libp2p.libp2p == null) {
    console.log("Must initialize the Libp2pService to display your info!")
    return
  }

  let exit = false;
  while (exit === false) {
    const context = libp2p.storage.getContext()!

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
        await displayMyInfo(libp2p)
        break;
      case "copyAddr":
        const addr = libp2p.libp2p.getMultiaddrs()[0].toString().split('/p2p')[0]
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
