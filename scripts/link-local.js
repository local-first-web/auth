import { execSync } from 'child_process'
import chalk from 'chalk'

const localPackages = ['auth-provider-automerge-repo', 'auth-syncserver']

const remotePackages = [
  '@automerge/automerge-repo',
  '@automerge/automerge-repo-network-broadcastchannel',
  '@automerge/automerge-repo-network-websocket',
  '@automerge/automerge-repo-react-hooks',
  '@automerge/automerge-repo-storage-indexeddb',
  '@automerge/automerge-repo-storage-nodefs',
].join(' ')

const isUnlink = process.argv.includes('--unlink')

log(chalk.yellow(`${isUnlink ? 'Unlinking from' : 'Linking to'} local automerge-repo packages`))

localPackages.forEach(localPackage => {
  log(`${chalk.dim('package: ')} ${chalk.yellow(localPackage)}`)
  const cmd = `pnpm -C packages/${localPackage} ${isUnlink ? 'unlink' : 'link'} --global ${remotePackages}`
  log(chalk.dim(`> ${cmd}`), '')
  execSync(cmd, { stdio: 'inherit' })
})

function log(...lines) {
  console.log([''].concat(lines).join('\n'))
}
