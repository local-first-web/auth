import * as auth from '@localfirst/auth'
import { Button, CardBody } from '@windmill/react-ui'
import debug from 'debug'
import { Fragment, useEffect, useState } from 'react'
import { assert } from '../util/assert'
import { users } from '../users'
import { CardLabel } from './CardLabel'
import { ChainDiagram } from './ChainDiagram'
import { Invite } from './Invite'
import { StatusIndicator } from './StatusIndicator'
import { useTeam } from '../hooks/useTeam'

export const Team = () => {
  const { team, user, connectionStatus } = useTeam()
  assert(team) // we know we're on a team if we're showing this component

  const [members, setMembers] = useState(team?.members())
  const log = debug(`lf:tc:Team:${user.userName}`)

  useEffect(() => {
    setMembers(team.members())
    team.on('updated', () => setMembers(team.members()))
    return () => {
      team.removeAllListeners()
    }
  }, [team])

  const userIsAdmin = team.memberIsAdmin(user.userName)
  const adminCount = () => members.filter(m => team.memberIsAdmin(m.userName)).length

  return (
    <>
      <CardBody className="Team">
        {/* Team name */}
        <CardLabel>Team</CardLabel>
        <p className="TeamName">{team.teamName}</p>

        {/* Members table */}
        <table className="MemberTable w-full border-collapse text-sm my-3">
          <tbody>
            {/* One row per member */}
            {members?.map(m => {
              const isAdmin = team.memberIsAdmin(m.userName)
              const isOnlyAdmin = isAdmin && adminCount() === 1
              const status = connectionStatus[m.userName] || 'disconnected'
              return (
                <Fragment key={m.userName}>
                  <tr className="border-t border-b border-gray-200 group">
                    {/* Admin icon, if admin */}
                    <td className="w-2">
                      <Button
                        layout="link"
                        size="small"
                        disabled={!userIsAdmin || isOnlyAdmin}
                        onClick={() => {
                          if (isAdmin) team.removeMemberRole(m.userName, auth.ADMIN)
                          else team.addMemberRole(m.userName, auth.ADMIN)
                        }}
                        title={
                          isOnlyAdmin
                            ? `Can't remove the only admin`
                            : isAdmin
                            ? 'Team admin (click to remove)'
                            : 'Click to make team admin'
                        }
                        className={`px-1 m-1 hover:opacity-25 ${
                          isAdmin ? 'opacity-100' : 'opacity-0 '
                        }`}
                        children="👑"
                      />
                    </td>

                    {/* Name & emoji */}
                    <td className="p-2">
                      {users[m.userName].emoji} <span className="UserName">{m.userName}</span>
                    </td>

                    {/* Connection status: Laptop */}
                    <td title={status}>
                      {m.userName === user.userName ? null : (
                        <div className="flex items-center">
                          <span className="mr-2">💻</span>
                          <StatusIndicator status={status}></StatusIndicator>
                        </div>
                      )}
                    </td>

                    {/* Remove button */}
                    <td>
                      {userIsAdmin ? (
                        <button
                          title="Remove member from team"
                          className="group-hover group-hover:opacity-100 opacity-0 font-bold"
                          children="❌"
                        />
                      ) : null}
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {/* Invitation UI */}
        {team.memberIsAdmin(user.userName) ? <Invite /> : null}
      </CardBody>

      {/* Chain visualization */}
      <CardBody className="border-t">
        <CardLabel>Signature chain</CardLabel>
        <ChainDiagram chain={team.chain} id={user.userName} />
      </CardBody>
    </>
  )
}
