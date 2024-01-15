import { UAParser } from "ua-parser-js"

export const getDeviceNameFromUa = () => {
  const { browser, os, device } = UAParser(navigator.userAgent) // eslint-disable-line new-cap
  return `${device.model ?? os.name} (${browser.name})`
}
