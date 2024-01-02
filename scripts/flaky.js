import { exec as _exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
// const cmd = 'pnpm test:log AuthProvider -- -t "persists public"'

const exec = promisify(_exec)

// ensure outputDir exists
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const outputDir = path.join(__dirname, '..', '.logs')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

// option to reuse the last test run (useful for tweaking the cleanup function without having to wait for tests to rerun)
const flag = process.argv[3]
const reuse = flag === '-r' || flag === '--reuse'

const cmd = process.argv[2]

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
  await exec(`cat .logs/${key}.raw.txt | node ./scripts/clean-log.js > .logs/${key}.txt`)
}

// commit everything so we can diff runs with each other
await exec(`git commit -a -m "update flaky test output"`)

// HELPERS

async function runTest() {
  try {
    // pipe stdout and stderr to log.txt
    await exec(`${cmd} &> ${outputDir}/log.txt`)
    // test passed
    return true
  } catch (error) {
    // test failed (we still got the output)
    return false
  }
}

function readFile(filename) {
  return fs.readFileSync(path.join(outputDir, filename), 'utf8')
}

function writeFile(filename, content) {
  const stringified = typeof content === 'string' ? content : JSON.stringify(content)
  fs.writeFileSync(path.join(outputDir, filename), stringified)
}
