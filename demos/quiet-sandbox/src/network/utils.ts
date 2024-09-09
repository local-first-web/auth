import * as os from 'os'

export type IPMap = {
  [interfaceName: string]: string[]
}

export const DEFAULT_NETWORK_INTERFACE = 'en0'

/*
Shamelessly copied from https://stackoverflow.com/a/8440736
*/
export function getIpAddresses(): IPMap {
  const interfaces = os.networkInterfaces();
  const results: IPMap = {}; // Or just '{}', an empty object

  for (const name in interfaces) {
      for (const net of interfaces[name]!) {
          // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
          // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
          const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
          if (net.family === familyV4Value && !net.internal) {
              if (!results[name]) {
                  results[name] = [];
              }
              results[name].push(net.address);
          }
      }
  }

  return results
}