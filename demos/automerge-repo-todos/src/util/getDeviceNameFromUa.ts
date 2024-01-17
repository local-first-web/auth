import { UAParser } from 'ua-parser-js'

export const getDeviceNameFromUa = () => {
  const { browser, os, device } = UAParser(navigator.userAgent)
  return `${device.model ?? os.name} (${browser.name})`
}
