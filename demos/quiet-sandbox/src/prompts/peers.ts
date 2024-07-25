#! /usr/bin/env ts-node

import { input } from '@inquirer/prompts';

import { Libp2pService } from '../network.js';
import actionSelect from '../components/actionSelect.js';
import { Peer, PeerId } from '@libp2p/interface';

export const PEER_TABLE_PROPERTIES = ['id', 'addresses', 'protocols', 'metadata', 'tags', 'peerRecordEnvelope']

const peerInfo = async (libp2p: Libp2pService | undefined) => {
  if (libp2p == null || libp2p.libp2p == null) {
    console.log("Must initialize the Libp2pService")
    return
  }

  let exit = false;
  while (exit === false) {
    const connectedPeers = libp2p.libp2p.getPeers()
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
    const peer: Peer = await libp2p.libp2p.peerStore.get(answer.answer)
    switch (answer.action) {
      case "select":
      case undefined:
        console.table([peer], PEER_TABLE_PROPERTIES);
        break;
      case "back":
        exit = true;
        return;
    }
  }
}

const peerConnect = async (libp2p: Libp2pService | undefined) => {
  if (libp2p == null || libp2p.libp2p == null) {
    console.log("Must initialize the Libp2pService")
    return false
  }

  const addr = await input({
    message: "What is the address of the peer you want to connect to?",
    default: undefined,
    validate: (addr: string) => addr != null ? true : "Must enter a valid peer address!"
  });

  const success = await libp2p.dial(addr);
  console.log(`Connection to ${addr} success? ${success}`)

  await peerInfo(libp2p)
}

export {
  peerInfo,
  peerConnect,
}
