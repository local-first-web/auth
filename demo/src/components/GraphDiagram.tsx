import { type TeamLink, type TeamLinkBody, type TeamGraph, type Hash } from '@localfirst/auth'
import React, { type FC } from 'react'
import { theme } from '../mermaid.theme'
import { devices, users } from '../peers'
import { Mermaid } from './Mermaid.js'

const LINE_BREAK = '\n'

// extract 5-char ID for Mermaid from hash
const getId = (s: string) =>
  s
    .replaceAll(/\W/g, '') // remove non alphanumeric chars
    .slice(0, 5) // truncate

export const GraphDiagram: FC<{ graph: TeamGraph; id: string }> = ({ graph: chain, id }) => {
  const chartHeader = [
    `graph TD`, // TD = top-down
    `classDef merge fill:#fc3,font-weight:bold,stroke-width:3px,text-align:center`, // css for merge nodes
  ]
  const keys = Object.keys(chain.links) as Hash[]
  const chartNodes = keys.map(hash => {
    const link = chain.links[hash]
    const id = getId(hash)
    return `${id}${mermaidNodeFromLink(link)}`
  })
  const chartEdges = keys.flatMap(hash => {
    const link = chain.links[hash]
    return mermaidEdgeFromLink(link)
  })

  const chart = chartHeader.concat(chartNodes).concat(chartEdges).join(LINE_BREAK)

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

  s = s.replaceAll('::', '')
  return s
}

const mermaidNodeFromLink = (link: TeamLink) => {
  {
    const { userId, type } = link.body

    const author = getUserName(userId)
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
  }

  return link.body.prev.map(hash => `${getId(hash)} --> ${getId(link.hash)}`)
}

const actionSummary = (action: TeamLinkBody) => {
  switch (action.type) {
    case 'ADD_MEMBER': {
      return action.payload.member.userName
    }

    case 'REMOVE_MEMBER': {
      return action.payload.userId
    }

    case 'ADD_ROLE': {
      return action.payload.roleName
    }

    case 'ADD_MEMBER_ROLE': {
      return `${action.payload.userId} ${action.payload.roleName}`
    }

    case 'REMOVE_MEMBER_ROLE': {
      return `${action.payload.userId} ${action.payload.roleName}`
    }

    case 'ADD_DEVICE': {
      return `${action.payload.device.userId}::${action.payload.device.deviceName}`
    }

    case 'REMOVE_DEVICE': {
      return `${action.payload.deviceId}`
    }

    case 'INVITE_MEMBER':
    case 'INVITE_DEVICE': {
      return action.payload.invitation.id
    }

    case 'REVOKE_INVITATION': {
      return action.payload.id
    }

    case 'ADMIT_DEVICE': {
      return action.payload.device.deviceName
    }

    case 'ADMIT_MEMBER': {
      return action.payload.memberKeys.name
    }

    case 'CHANGE_MEMBER_KEYS': {
      return action.payload.keys.name
    }

    default: {
      return ''
    }
    // throw new Error(`Unrecognized action type: ${action.type}`)
  }
}

const truncateHashes = (s: string) => s.replaceAll(hashRx, getId)
const hashRx = /(?:[A-Za-z\d+/=]{12,100})?/gm

function getUserName(userId: string) {
  return userId.split('-')[0]
}
