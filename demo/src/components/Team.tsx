import * as auth from '@localfirst/auth'
import { type MemberContext } from '@localfirst/auth'
import { assert } from '@localfirst/auth-shared'
import * as React from 'react'
import { useTeam } from '../hooks/useTeam.js'
import { devices, users } from '../peers.js'
import { CardLabel } from './CardLabel.js'
import { GraphDiagram } from './GraphDiagram.js'
import { Invite } from './Invite.js'
import { OnlineToggle } from './OnlineToggle.js'
import { StatusIndicator } from './StatusIndicator.js'

export const Team = () => {
  const { team, user, device, online, connect, disconnect, connectionStatus } = useTeam()

  assert(team) // we know we're on a team if we're showing this component
  assert(user)

  const { userId } = user

  const userBelongsToTeam = team.has(userId)
  const userIsAdmin = userBelongsToTeam && team.memberIsAdmin(userId)
  const adminCount = () => team.members().filter(m => team.memberIsAdmin(m.userId)).length

  return (
    <>
      <div className="Team p-4">
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
                  const context = { user, device, team } as MemberContext
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
              const memberIsAdmin = team.memberIsAdmin(m.userId)
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
                      <button
                        disabled={!userIsAdmin || memberIsOnlyAdmin}
                        onClick={() => {
                          if (memberIsAdmin) team.removeMemberRole(m.userId, auth.ADMIN)
                          else team.addMemberRole(m.userId, auth.ADMIN)
                        }}
                        title={adminToggleTitle}
                        className={`px-1 m-1 hover:opacity-25 cursor-pointer ${
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
                    {users[m.userName!].emoji}
                    <span className="UserName ml-1">{m.userName}</span>
                  </td>

                  {/* Connection status */}

                  <td className="flex py-2">
                    {m.devices?.map(d => {
                      const emoji = devices[d.deviceName].emoji
                      const status = connectionStatus[d.deviceId] || 'disconnected'
                      const isThisDevice = d.keys.name === device.keys.name
                      return isThisDevice ? null : (
                        <div
                          key={`${d.keys.name}`}
                          title={status}
                          className="flex items-center pr-3"
                        >
                          <span className="mr-1">{emoji}</span>
                          <StatusIndicator status={status} />
                        </div>
                      )
                    })}
                  </td>

                  {/* Remove Button */}
                  <td>
                    {userIsAdmin && !memberIsOnlyAdmin ? (
                      <button
                        title="Remove member from team"
                        className="hover:opacity-100 opacity-10 font-bold text-xs text-white bg-red-500 rounded-full w-4 h-4 "
                        onClick={() => {
                          team.remove(m.userId)
                        }}
                        children="⨉"
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
      </div>

      {/* Chain visualization */}
      <div className="border-t p-4">
        <CardLabel>Signature chain</CardLabel>
        <GraphDiagram graph={team.graph} id={device.keys.name.replace(/::/, '-')} />
      </div>
    </>
  )
}
