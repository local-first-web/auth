import fs from 'fs'
import path from 'path'
import { setup } from './setup'

const { alice, bob, charlie, dwight, eve } = setup(['alice', 'bob', 'charlie', 'dwight', 'eve'])

const output = {
  users: { alice, bob, charlie, dwight, eve },
  chain: alice.team.chain,
}

const assetPath = path.join(__dirname, 'assets.json')

fs.writeFileSync(assetPath, JSON.stringify(output, null, 2))
