import { exec as _exec } from 'child_process'
import fs, { appendFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
const exec = promisify(_exec)

// ensure outputDir exists
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const outputDir = path.join(__dirname, '..', '.logs')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
const prevFile = path.join(outputDir, 'prev.txt')
const outputFile = path.join(outputDir, 'log.txt')

if (fs.existsSync(outputFile)) {
  fs.writeFileSync(prevFile, fs.readFileSync(outputFile).toString())
} else {
  fs.writeFileSync(prevFile, '')
}

const output = []
process.stdin
  .on('data', data => {
    output.push(data.toString())
  })

  .on('end', () => {
    const trimmed = output.map(line => line.trim())
    const filtered = trimmed.filter(filterLogs)
    const cleaned = cleanLogs(filtered.join('\n'))
    fs.writeFileSync(outputFile, cleaned)
  })

function filterLogs(line) {
  return (
    line.length > 0 &&
    !line.startsWith('>') &&
    !line.startsWith('RUN') &&
    !line.startsWith('[vite]') &&
    !line.startsWith('Download the React DevTools') &&
    !line.includes('websocket:') &&
    !line.includes('Adapters ready')
  )
}

// Reduce visual noise to a minimum in the logs
function cleanLogs(output) {
  const A = 65
  const Z = 90
  let i = A
  let tokens = {
    // A1FR9f: A,
    // Q4SKk9: B,
    // etc.
  }

  const deviceIds = [...output.matchAll(/user(?:Name)?: '?(\w+)'?, deviceId: '?(\w+)'?/g)].map(
    match => {
      return {
        userName: match[1],
        deviceId: match[2],
      }
    }
  )

  const teamIds = [...output.matchAll(/shareId: '(\w+)'/g)].map((match, i) => ({
    teamName: `TEAM-${i + 1}`,
    teamId: match[1],
  }))

  const documentIds = [...output.matchAll(/create.*?document (\w+)/gi)].map((match, i) => ({
    documentName: `DOC-${i + 1}`,
    documentId: match[1],
  }))

  // replace all instances of any given hash with a single letter
  // this makes it possible to diff different runs of the test
  function tokenize(match, p1) {
    if (i > Z) i = A
    const token = tokens[p1] ?? String.fromCharCode(i++)
    tokens[p1] = token
    return match.replace(p1, token)
  }

  const prefixes = [
    ['message-queue ', 'msg-queue'],
    ['connection:', 'auth-conn'],
    ['auth-provider:', 'auth-prov'],
    ['network:', 'network'],
    ['repo ', 'repo'],
    ['syncserver ', 'server'],
    ['collectionsync ', 'col-sync'],
    ['remote-heads-subscriptions ', 'heads'],
    ['dochandle:', 'handle'],
    ['docsync:', 'doc-sync'],
    ['storage-subsystem ', 'storage'],
    ['stdout:', '*'],
  ]
  const prefixColWidth = prefixes.reduce(
    (acc, [, replacement]) => Math.max(acc, replacement.length),
    0
  )

  const transforms = [
    // strip ANSI color codes
    [/\u001B\[\d+m/g, ''],
    [/\[[0-9;]+m/g, ''],

    // Remove quotes
    [/"|'|`/g, ''],

    // Remove prefixes
    [/\[WebServer\]|localfirst\:|auth\:|automerge-repo\:|/g, ''],

    // Remove timestamps
    [/\+\d+(ms|s)/g, ''],
    [/timestamp: \d+/g, ''],

    // Remove snapshot hashes
    [/snapshot,(\w+)/g, ''],

    // Remove %o %s
    [/ %o/g, ''],
    [/ %s/g, ''],

    // condense stdout
    [/^stdout.*\n/gm, 'stdout:'],

    // replace deviceIds with userNames
    ...deviceIds.map(({ userName, deviceId }) => [new RegExp(deviceId, 'g'), userName]),

    // tokenize teamIds as TEAM-1 etc
    ...teamIds.map(({ teamId, teamName }) => [new RegExp(teamId, 'g'), teamName]),

    // tokenize documentIds as DOC-1 etc
    ...documentIds.map(({ documentId, documentName }) => [
      new RegExp(documentId, 'g'),
      documentName,
    ]),
    //  truncated documentIds
    ...documentIds.map(({ documentId, documentName }) => [
      new RegExp(documentId.slice(0, 5), 'g'),
      documentName,
    ]),

    // Tokenize remaining hashes
    [/\b(?=\w*\d)(\w{10,})\b/g, tokenize],

    // Remove buffers
    [/(<Buffer(\w|\s|\.)+(>|$))|({\s*0:[0-9:,]+})|\[(\s|\d|,)+\d+?(]|$)/g, '...'],

    [/\[Object]/gi, '{...}'],
    [/\[Array]/gi, '[...]'],

    // emoji
    [/noise/gi, '🐒'],
    [/alice/gi, '👩🏾'],
    [/bob/gi, '👨‍🦲'],
    [/charlie/gi, '👳🏽‍♂️'],
    [/dwight/gi, '👴'],
    [/herb/gi, '🤓'],
    [/laptop/gi, '💻'],
    [/localhost/gi, '🤖'],
    [/phone/gi, '📱'],

    // Collapse whitespace
    [/( |\t)+/g, ' '],
    [/^\s+/gm, ''],
    [/\s+$/gm, ''],

    // Replace prefixes with short fixed-length versions
    ...prefixes.map(([prefix, replacement]) => [
      new RegExp(prefix, 'gm'),
      replacement.padEnd(prefixColWidth) + ' | ',
    ]),
  ]
  return transforms.reduce((acc, [rx, replacement]) => acc.replaceAll(rx, replacement), output)
}

function readFile(filename) {
  return fs.readFileSync(path.join(outputDir, filename), 'utf8')
}

function writeFile(filename, content) {
  const stringified = typeof content === 'string' ? content : JSON.stringify(content)
  fs.writeFileSync(path.join(outputDir, filename), stringified)
}
