import { exec as _exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const exec = promisify(_exec)

// ensure outputDir exists
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const outputDir = path.join(__dirname, '..', '.flaky')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

// option to reuse the last test run (useful for tweaking the cleanup function without having to wait for tests to rerun)
const flag = process.argv[2]
const reuse = flag === '-r' || flag === '--reuse'

const output = {
  good: undefined,
  bad: undefined,
}
const maxRuns = 25 // don't keep trying forever

// collect good & bad test logs
if (reuse) {
  console.log('Reusing the last test run')
  output.good = readFile('good.raw.txt')
  output.bad = readFile('bad.raw.txt')
} else {
  console.log('Running test until we have one success and one failure')

  for (let i = 0; i < maxRuns; i++) {
    const passed = await runTest()
    const report = readFile('log.txt')

    if (passed) {
      console.log('✅')
      writeFile('good.raw.txt', report)
      output.good = report
    } else {
      console.log('❌')
      writeFile('bad.raw.txt', report)
      output.bad = report
    }

    // once we have one of each we can continue
    if (output.bad && output.good) break
  }
}

// clean up both sets of logs and output good.txt and bad.txt
for (const key in output) {
  console.log(`Writing ${key}.txt `)
  const outputLines = output[key].split('\n')
  const filtered = outputLines.filter(filterLogs)
  const combined = filtered.join('\n')
  const cleaned = cleanLogs(combined)
  writeFile(`${key}.txt`, cleaned)
}

// commit everything so we can diff runs with each other
await exec(`git commit -a -m "update flaky test output"`)

// HELPERS

async function runTest() {
  try {
    // pipe stdout and stderr to log.txt
    await exec(`pnpm test:pw &> ${outputDir}/log.txt`)
    // test passed
    return true
  } catch (error) {
    // test failed (we still got the output)
    return false
  }
}

function filterLogs(line) {
  return (
    line.length > 0 &&
    !line.startsWith('[vite]') &&
    !line.startsWith('Download the React DevTools') &&
    !line.includes('websocket:') &&
    !line.includes('Adapters ready')
  )
}

// Reduce visual noise to a minimum in the logs, making it easier to visually spot patterns in the diff
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

  const deviceIds = [...output.matchAll(/{user: (\w+), deviceId: (\w+)}/g)].map(match => {
    return {
      userName: match[1],
      deviceId: match[2],
    }
  })

  const teamIds = [...output.matchAll(/shareId: (\w+)/gi)].map((match, i) => ({
    teamName: `TEAM-${i + 1}`,
    teamId: match[1],
  }))

  const documentIds = [...output.matchAll(/created root document (\w+)/gi)].map((match, i) => ({
    documentName: `DOC-${i + 1}`,
    documentId: match[1],
  }))

  const transforms = [
    // strip ANSI color codes
    [/\u001B\[\d+m/g, ''],
    [/\[[0-9;]+m/g, ''],

    // Remove pnpm commands
    [/^>.*$/gm, ''],

    // Remove quotes
    [/"|'|`/g, ''],

    // Remove pnpm commands
    [/^>.*$/gm, ''],

    // Remove quotes
    [/"|'|`/g, ''],

    // Remove prefixes
    [/\[WebServer\]|localfirst\:auth\:|automerge-repo\:|/g, ''],

    // Remove timestamps
    [/\+\d+(ms|s)/g, ''],
    [/timestamp: \d+/g, ''],

    // Remove %o %s
    [/ %o/g, ''],
    [/ %s/g, ''],

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
    [/(<Buffer(\w|\s|\.)+(>|$))|({\s*0:[0-9:,]+})|\[(\s|\d|,)+.*?(]|$)/g, '...'],

    // Collapse whitespace
    [/( |\t)+/g, ' '],
    [/^\s+/gm, ''],
    [/\s+$/gm, ''],
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
