import * as Auth from '@localfirst/auth'
import { useAuth } from '../hooks/useAuth'
import { useState } from 'react'

export function TeamMembers() {
  const { user, team } = useAuth()

  const [members, setMembers] = useState(team.members())
  team.on('updated', () => setMembers(team.members()))

  const { userId } = user
  const userBelongsToTeam = team.has(userId)
  const userIsAdmin = userBelongsToTeam && team.memberIsAdmin(userId)
  const adminCount = () => team.members().filter(m => team.memberIsAdmin(m.userId)).length

  return (
    <>
      <h4>{team.teamName} members</h4>
      <table className="MemberTable w-full border-collapse text-sm my-3">
        <tbody>
          {/* One row per member */}
          {members.map(m => {
            const memberIsAdmin = team.memberIsAdmin(m.userId)
            const memberIsOnlyAdmin = memberIsAdmin && adminCount() === 1
            let message = ''
            if (memberIsOnlyAdmin) {
              message = `Can't remove the only admin`
            } else {
              message = memberIsAdmin ? 'Team admin (click to remove)' : 'Click to make team admin'
            }

            const adminToggleTitle = message

            return (
              <tr key={m.userName} className="border-t border-b border-gray-200 group">
                {/* Admin icon */}
                <td className="w-2">
                  {userIsAdmin ? (
                    <button
                      disabled={!userIsAdmin || memberIsOnlyAdmin}
                      onClick={() => {
                        if (memberIsAdmin) team.removeMemberRole(m.userId, Auth.ADMIN)
                        else team.addMemberRole(m.userId, Auth.ADMIN)
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
                  <span className="UserName ml-1">{m.userName}</span>
                </td>

                {/* Connection status */}
                {/* 
              <td className="flex py-2">
                {m.devices?.map((d: Device) => {
                  const status = "disconnected"
                  // connectionStatus[Auth.device.getDeviceId(d)] ||
                  // "disconnected"
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
              </td> */}

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
    </>
  )
}
