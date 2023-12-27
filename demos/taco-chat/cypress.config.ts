import { defineConfig } from 'cypress'
import createBundler from '@bahmutov/cypress-esbuild-preprocessor'

export default defineConfig({
  e2e: {
    projectId: 'taco',
    baseUrl: 'http://localhost:3000',

    fixturesFolder: false,
    video: false,
    viewportWidth: 1600,
    viewportHeight: 1200,
    defaultCommandTimeout: 10000,

    // experimentalRunAllSpecs: true,

    setupNodeEvents(on) {
      on('file:preprocessor', createBundler())
      on('before:browser:launch', (browser: any = {}, launchOptions: any) => {
        if (browser.family === 'chromium' && browser.name !== 'electron' && browser.isHeaded) {
          // auto open devtools
          launchOptions.args.push('--auto-open-devtools-for-tabs')

          // remove "Chrome is being controlled..." infobar
          launchOptions.args = launchOptions.args.filter((a: string) => a !== '--enable-automation')

          // allow debugging in vs code
          launchOptions.args.push('--remote-debugging-port=9222')

          return launchOptions
        }

        // whatever you return here becomes the launchOptions
        return launchOptions
      })
    },
  },
})
