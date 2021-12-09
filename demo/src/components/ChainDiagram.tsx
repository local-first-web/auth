import { LinkBody, TeamAction, TeamLink, TeamLinkBody, TeamSignatureChain } from '@localfirst/auth'
import React, { FC } from 'react'
import { theme } from '../mermaid.theme'
import { devices, users } from '../peers'
import { Mermaid } from './Mermaid'

const LINE_BREAK = '\n'

// extract 5-char ID for Mermaid from hash
const getId = (s: string) =>
  s
    .replace(/\W/g, '') // remove non alphanumeric chars
    .slice(0, 5) // truncate

export const ChainDiagram: FC<{ chain: TeamSignatureChain; id: string }> = ({ chain, id }) => {
  const chartHeader = [
    `graph TD`, // TD = top-down
    `classDef merge fill:#fc3,font-weight:bold,stroke-width:3px,text-align:center`, // css for merge nodes
  ]

  const chartNodes = Object.keys(chain.links).map(hash => {
    const link = chain.links[hash]
    const id = getId(hash)
    return `${id}${mermaidNodeFromLink(link)}`
  })

  const chartEdges = Object.keys(chain.links).flatMap(hash => {
    const link = chain.links[hash]
    return mermaidEdgeFromLink(link)
  })

  const chart = chartHeader
    .concat(chartNodes)
    .concat(chartEdges)
    .join(LINE_BREAK)

  return (
    <div className="ChainDiagram">
      <Mermaid config={theme} chart={chart} id={id} />
    </div>
  )
}

const replaceNamesWithEmoji = (s: string) => {
  for (const userName in users) {
    const { emoji } = users[userName]
    const rx = new RegExp(userName, 'gi')
    s = s.replace(rx, emoji)
  }
  for (const deviceName in devices) {
    const { emoji } = devices[deviceName]
    const rx = new RegExp(deviceName, 'gi')
    s = s.replace(rx, emoji)
  }
  s = s.replace(/::/g, '')
  return s
}

const mermaidNodeFromLink = (link: TeamLink) => {
  {
    const author = link.signed.userName
    const type = link.body.type
    const summary = actionSummary(link.body)

    let node = `("
        <div class='author'>${author}</div>
        <div><b>${type}</b></div>
        <div>${summary}</div>
      ")`

    node = replaceNamesWithEmoji(node)
    node = truncateHashes(node)
    return node
  }
}

const mermaidEdgeFromLink = (link: TeamLink) => {
  if (link.body.type === 'ROOT') {
    return ''
  } else {
    return link.body.prev.map(hash => `${getId(hash)} --> ${getId(link.hash)}`)
  }
}

const actionSummary = (action: TeamLinkBody) => {
  switch (action.type) {
    case 'ADD_MEMBER':
      return action.payload.member.userName
    case 'REMOVE_MEMBER':
      return action.payload.userName
    case 'ADD_ROLE':
      return action.payload.roleName
    case 'ADD_MEMBER_ROLE':
      return `${action.payload.userName} ${action.payload.roleName}`
    case 'REMOVE_MEMBER_ROLE':
      return `${action.payload.userName} ${action.payload.roleName}`
    case 'ADD_DEVICE':
      return `${action.payload.device.userName}::${action.payload.device.deviceName}`
    case 'REMOVE_DEVICE':
      return `${action.payload.userName}::${action.payload.deviceName}`
    case 'INVITE_MEMBER':
    case 'INVITE_DEVICE':
      return action.payload.invitation.id
    case 'REVOKE_INVITATION':
      return action.payload.id
    case 'ADMIT_DEVICE':
      return action.payload.deviceName
    case 'ADMIT_MEMBER':
      return action.payload.memberKeys.name
    case 'CHANGE_MEMBER_KEYS':
    case 'CHANGE_DEVICE_KEYS':
      return action.payload.keys.name
    default:
      return ''
    // throw new Error(`Unrecognized action type: ${action.type}`)
  }
}

const truncateHashes = (s: string) => s.replace(hashRx, getId)
const hashRx = /(?:[A-Za-z0-9+/=]{12,100})?/gm
