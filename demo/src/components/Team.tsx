import * as auth from '@localfirst/auth'
import { Button, CardBody } from '@windmill/react-ui'
import React from 'react'
import { useTeam } from '../hooks/useTeam'
import { devices, users } from '../peers'
import { assert } from '../util/assert'
import { CardLabel } from './CardLabel'
import { ChainDiagram } from './ChainDiagram'
import { Invite } from './Invite'
import { OnlineToggle } from './OnlineToggle'
import { StatusIndicator } from './StatusIndicator'

import debug from 'debug'

export const Team = () => {
  const { team, user, device, online, connect, disconnect, connectionStatus } = useTeam()

  assert(team) // we know we're on a team if we're showing this component
  assert(user)

  const { userName } = user

  const userBelongsToTeam = team.has(user.userName)
  const userIsAdmin = userBelongsToTeam && team.memberIsAdmin(user.userName)
  const adminCount = () => team.members().filter(m => team.memberIsAdmin(m.userName)).length

  return (
    <>
      <CardBody className="Team">
        {/* Team name */}
        <div className="flex">
          <div className="flex-grow">
            <CardLabel>Team</CardLabel>
            <p className="TeamName">{team.teamName}</p>
          </div>

          {/* Online/offline switch */}
          <div className="text-right">
            <OnlineToggle
              isOnline={online}
              onChange={isConnected => {
                if (isConnected) {
                  const context = { userName, user, device, team }
                  connect(team.teamName, context)
                } else {
                  disconnect()
                }
              }}
            />
          </div>
        </div>

        {/* Members table */}
        <table className="MemberTable w-full border-collapse text-sm my-3">
          <tbody>
            {/* One row per member */}
            {team.members()?.map(m => {
              const memberIsAdmin = team.memberIsAdmin(m.userName)
              const memberIsOnlyAdmin = memberIsAdmin && adminCount() === 1

              const adminToggleTitle = memberIsOnlyAdmin
                ? `Can't remove the only admin`
                : memberIsAdmin
                ? 'Team admin (click to remove)'
                : 'Click to make team admin'

              return (
                <tr key={m.userName} className="border-t border-b border-gray-200 group">
                  {/* Admin icon */}
                  <td className="w-2">
                    {userIsAdmin ? (
                      <Button
                        layout="link"
                        size="small"
                        disabled={!userIsAdmin || memberIsOnlyAdmin}
                        onClick={() => {
                          if (memberIsAdmin) team.removeMemberRole(m.userName, auth.ADMIN)
                          else team.addMemberRole(m.userName, auth.ADMIN)
                        }}
                        title={adminToggleTitle}
                        className={`px-1 m-1 hover:opacity-25  ${
                          memberIsAdmin ? 'opacity-100' : 'opacity-0 disabled:opacity-0'
                        }`}
                        children="👑"
                      />
                    ) : memberIsAdmin ? (
                      <span title="Member is admin">👑</span>
                    ) : null}
                  </td>

                  {/* Name & emoji */}
                  <td className="p-2">
                    {users[m.userName].emoji} <span className="UserName">{m.userName}</span>
                  </td>

                  {/* Connection status */}

                  <td className="flex py-2">
                    {m.devices?.map(d => {
                      const emoji = devices[d.deviceName].emoji
                      const status = connectionStatus[auth.device.getDeviceId(d)] || 'disconnected'
                      const isThisDevice = d.keys.name === device.keys.name
                      return !isThisDevice ? (
                        <div
                          key={`${d.keys.name}`}
                          title={status}
                          className="flex items-center pr-3"
                        >
                          <span className="mr-1">{emoji}</span>
                          <StatusIndicator status={status} />
                        </div>
                      ) : null
                    })}
                  </td>

                  {/* Remove button */}
                  <td>
                    {userIsAdmin && !memberIsOnlyAdmin ? (
                      <button
                        title="Remove member from team"
                        className="hover:opacity-100 opacity-10 font-bold"
                        onClick={() => {
                          team.remove(m.userName)
                        }}
                        children="⛔"
                      />
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Invitation UI */}
        <Invite />
      </CardBody>

      {/* Chain visualization */}
      <CardBody className="border-t">
        <CardLabel>Signature chain</CardLabel>
        <ChainDiagram chain={team.chain} id={device.keys.name.replace(/::/, '-')} />
      </CardBody>
    </>
  )
}
