export default (on: Function, config: any) => {
  on('before:browser:launch', (browser: any = {}, launchOptions: any) => {
    if (browser.family === 'chromium' && browser.name !== 'electron') {
      // auto open devtools
      launchOptions.args.push('--auto-open-devtools-for-tabs')

      // remove "Chrome is being controlled..." infobar
      launchOptions.args = launchOptions.args.filter((a: string) => a !== '--enable-automation')
    }

    // whatever you return here becomes the launchOptions
    return launchOptions
  })
}
