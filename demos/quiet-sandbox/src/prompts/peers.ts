#! /usr/bin/env ts-node

import { input } from '@inquirer/prompts';
import { Peer, PeerId } from '@libp2p/interface';
import clipboard from 'clipboardy';
import { peerIdFromString } from '@libp2p/peer-id';

import { Networking } from '../network.js';
import actionSelect from '../components/actionSelect.js';

const peerInfo = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper")
    return
  }

  let exit = false;
  while (exit === false) {
    const connectedPeers = networking.libp2p.libp2p.getPeers()
    if (connectedPeers.length == 0) {
      console.log(`No connected peers!  Use the "add" function to connect a new peer!`)
      return
    }

    const answer = await actionSelect({
      message: "Select a connected peer",
      choices: connectedPeers.map((peerId: PeerId) => {
        return {
          name: peerId.toString(),
          value: peerId,
        };
      }),
      actions: [
        { name: "Select", value: "select", key: "e" },
        { name: "Back", value: "back", key: "q" },
      ],
    });
    const peer: Peer = await networking.libp2p.libp2p.peerStore.get(answer.answer)
    switch (answer.action) {
      case "select":
      case undefined:
        console.table([peer]);
        break;
      case "back":
        exit = true;
        return;
    }
  }
}

const peerConnect = async (networking: Networking | undefined) => {
  if (networking == null || networking.libp2p == null || networking.libp2p.libp2p == null) {
    console.log("Must initialize the Networking wrapper")
    return
  }

  const addr = await input({
    message: "What is the address of the peer you want to connect to?",
    default: await clipboard.read(),
    validate: (addr: string) => addr != null ? true : "Must enter a valid peer address!"
  });

  const success = await networking.libp2p.dial(addr);
  console.log(`Connection to ${addr} success? ${success}`)

  await peerInfo(networking)
}

export {
  peerInfo,
  peerConnect,
}
