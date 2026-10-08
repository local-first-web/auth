/*
example usage:

> pnpm test:pw |& node ./scripts/clean-log.js > ./logs/log.txt && code ./logs/log.txt

*/

const output = []
process.stdin
  .on('data', line => output.push(line.toString()))
  .on('end', () => {
    const combinedOutput = output.map(line => line.trim()).join('\n')
    process.stdout.write(cleanLogs(combinedOutput))
  })

// Reduce visual noise to a minimum in the logs
function cleanLogs(output) {
  const A = 65
  const Z = 90
  let i = A
  const tokens = {
    // A1FR9f: A,
    // Q4SKk9: B,
    // etc.
  }

  // replace all instances of any given hash with a single letter
  // this makes it possible to diff different runs of the test
  function tokenize(match, p1) {
    if (i > Z) i = A
    const token = tokens[p1] ?? String.fromCodePoint(i++)
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
    [/["'`]/g, ''],

    [/^>.*?$/gm, ''],
    [/^RUN.*?$/gm, ''],
    [/^\[vite].*?$/gm, ''],
    [/^Download the React DevTools.*?$/gm, ''],
    [/^.*websocket:.*?$/gm, ''],

    // Remove ANSI escape codes. Matching them means putting a control character in a regex, which
    // is exactly what no-control-regex is for; here it's the point of the transform.
    /* eslint-disable no-control-regex */
    [/\u001B\[\d+m/g, ''],
    [/\u001B\[[\d;]+m/g, ''],
    /* eslint-enable no-control-regex */

    // Remove prefixes
    [/\[WebServer]|localfirst:|auth:|automerge-repo:|/g, ''],

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

    // tokenize shareIds as TEAM-1 etc
    ...[...output.matchAll(/shareId: '?(\w+)'?/g)]
      .map(match => match[1])
      .reduce(unique, [])
      .map((shareId, i) => [
        // the shareId is a truncated team id; also match the full team id
        new RegExp(shareId + '\\w*', 'g'),
        `TEAM-${i + 1}`,
      ]),

    // tokenize documentIds as DOC-1 etc
    ...[...output.matchAll(/dochandle:(\w+)/gi)]
      // reduce to unique documentIds
      .map(match => match[1])
      .reduce(unique, [])
      .map((documentId, i) => [
        // these are truncated document ids; also match the full document id
        new RegExp(documentId.slice(0, 5) + '\\w*', 'g'),
        `DOC-${i + 1}`,
      ]),

    // Tokenize remaining hashes
    [/\b(?=\w*\d)([-\w]{10,})\b/g, tokenize],

    // Remove buffers
    [/(<Buffer([.\s\w])+(>|$))/gm, '...'],
    [/({\s*0:[\d:,]+})|\[([,\d\s])+\d+?(]|$)/gm, '...'],
    [/\s*((\d+,)\s+){4,}(\.{3} \d+ more items)?\s*/g, '...'],

    [/\[object]/gi, '{...}'],
    [/\[array]/gi, '[...]'],

    // emoji
    [/noise/gi, '🐒'],
    [/alice/gi, '👩🏾'],
    [/bob/gi, '👨‍🦲'],
    [/charlie/gi, '👳🏽‍♂️'],
    [/dwight/gi, '👴'],
    [/eve/gi, '🦹'],
    [/herb/gi, '🤓'],
    [/ritika/gi, '🥷'],
    [/laptop/gi, '💻'],
    [/localhost/gi, '🤖'],
    [/phone/gi, '📱'],

    [/(\bconnected\b)/gi, ' ✅ $1'],
    [/(\bpassed\b)/gi, ' ✅ $1'],
    [/(\bdisconnected\b)/gi, ' ❌ $1'],
    [/(\berror\b)/gi, ' ❌ $1'],

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

// reduce to unique values
function unique(acc, x) {
  if (!acc.includes(x)) acc.push(x)
  return acc
}
