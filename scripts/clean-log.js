import { exec as _exec } from 'child_process'
import fs, { appendFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
const exec = promisify(_exec)

const output = []
process.stdin
  .on('data', data => {
    output.push(data.toString())
  })

  .on('end', () => {
    process.stdout.write(cleanLogs(output.map(line => line.trim()).join('\n')))
  })

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
    ['messagechannel ', 'msg-chan'],
    ['connection:', 'auth-conn'],
    ['auth-provider:', 'auth-prov'],
    ['network:', 'network'],
    ['repo ', 'repo'],
    ['syncserver ', 'server'],
    ['collectionsync ', 'col-sync'],
    ['remote-heads-subscriptions ', 'heads'],
    ['dochandle:', 'dochandle'],
    ['docsync:', 'doc-sync'],
    ['storage-subsystem ', 'storage'],
    ['stdout:', '*'],
    ['anonymous-auth-conn', 'anon-conn'],
  ]
  const prefixColWidth = prefixes.reduce(
    (acc, [, replacement]) => Math.max(acc, replacement.length),
    0
  )

  const transforms = [
    // Remove quotes
    [/"|'|`/g, ''],

    [/^\>.*?$/gm, ''],
    [/^RUN.*?$/gm, ''],
    [/^\[vite\].*?$/gm, ''],
    [/^Download the React DevTools.*?$/gm, ''],
    [/^.*websocket:.*?$/gm, ''],

    // Remove ANSI escape codes
    [/\u001B\[\d+m/g, ''],
    [/\[[0-9;]+m/g, ''],

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
    ...[...output.matchAll(/user(?:Name)?: '?(\w+)'?, deviceId: '?(\w+)'?/g)] //
      .map(match => ({ userName: match[1], deviceId: match[2] }))
      .map(({ userName, deviceId }) => [new RegExp(deviceId, 'g'), userName]),

    // // tokenize teamIds as TEAM-1 etc
    // ...[...output.matchAll(/shareId: '?(\w+)'?/g)]
    //   .map((match, i) => ({
    //     teamName: `TEAM-${i + 1}`,
    //     teamId: match[1],
    //   }))
    //   .map(({ teamId, teamName }) => [new RegExp(teamId, 'g'), teamName]),

    // tokenize documentIds as DOC-1 etc
    ...[...output.matchAll(/create.*?document (\w+)/gi)]
      .map((match, i) => ({
        documentName: `DOC-${i + 1}`,
        documentId: match[1],
      }))
      .flatMap(({ documentId, documentName }) => [
        [new RegExp(documentId, 'g'), documentName],
        //  truncated documentIds
        [new RegExp(documentId.slice(0, 5), 'g'), documentName],
      ]),

    // Tokenize remaining hashes
    [/\b(?=\w*\d)((?:\w|-){10,})\b/g, tokenize],

    // Remove buffers
    [/(<Buffer(\w|\s|\.)+(>|$))/gm, '...'],
    [/({\s*0:[0-9:,]+})|\[(\s|\d|,)+\d+?(]|$)/gm, '...'],
    [/\s*(([0-9]+,)\s+){4,}(\.\.\. \d+ more items)?\s*/g, '...'],

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

    [/(connected)/gi, ' ✅ $1'],
    [/(passed)/gi, ' ✅ $1'],
    [/(disconnected)/gi, ' ❌ $1'],
    [/(error)/gi, ' ❌ $1'],

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
