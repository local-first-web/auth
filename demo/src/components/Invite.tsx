import { Button, Select } from '@windmill/react-ui'
import ClipboardJS from 'clipboard'
import React from 'react'
import { useTeam } from '../hooks/useTeam'
import { UserInfo, users } from '../users'
import { assert } from '../util/assert'

/*
TODO implement different levels of invitation security

From most secure to least secure:

- named invitation with unique secret code

- named invitation with shared secret code

- anyone who has shared secret code can join
- named invitation, no secret code

- anyone who knows team name can join

*/
export const Invite = () => {
  type State = 'inactive' | 'requestingName' | 'done'

  const [state, setState] = React.useState<State>('inactive')
  const [seed, setSeed] = React.useState<string>()
  const [userName, setUserName] = React.useState<string>()

  const { team, user } = useTeam()

  const select = React.useRef() as React.MutableRefObject<HTMLSelectElement>
  const copyInvitationSeedButton = React.useRef() as React.MutableRefObject<HTMLButtonElement>

  React.useEffect(() => {
    let c: ClipboardJS
    if (copyInvitationSeedButton?.current && seed) {
      c = new ClipboardJS(copyInvitationSeedButton.current)
    }
    return () => {
      c?.destroy()
    }
  }, [copyInvitationSeedButton, seed])

  const invite = () => {
    assert(team)
    const userName = select.current.value
    setUserName(userName)

    const seed = `${team.teamName}-${randomSeed()}`
    setSeed(seed)

    // TODO we're storing id so we can revoke - wire that up
    const { id } = team.invite({ userName, seed })

    setState('done')
  }

  const userIsAdmin = team?.memberIsAdmin(user.userName)

  switch (state) {
    case 'inactive':
      return (
        <div className="Invite flex gap-2">
          {/* anyone can "invite" a device*/}
          <Button size="small" className="my-2 mr-2">
            Add a device
          </Button>

          {/* only admins can invite users */}
          {userIsAdmin ? (
            <Button
              size="small"
              className="my-2 mr-2"
              onClick={() => {
                setState('requestingName')
              }}
            >
              Invite someone
            </Button>
          ) : null}
        </div>
      )

    case 'requestingName':
      const isMember = (user: UserInfo) =>
        team
          ? team
              .members()
              .map(m => m.userName)
              .includes(user.name)
          : false

      const nonMembers = Object.values(users).filter(u => !isMember(u))

      return (
        <>
          <p>Who do you want to invite?</p>

          <div className="flex gap-2">
            {/* Dropdown with names & emoji */}
            <Select ref={select} className="InviteWho mt-1 w-full" css="">
              {nonMembers.map(u => (
                <option key={u.name} value={u.name}>
                  {u.emoji} {u.name}
                </option>
              ))}
            </Select>

            <Button className="InviteButton mt-1 w-full" onClick={invite}>
              Invite
            </Button>
          </div>

          <Button
            size="small"
            layout="outline"
            className="CancelButton mt-1"
            onClick={() => {
              setState('inactive')
            }}
          >
            Cancel
          </Button>
        </>
      )

    case 'done':
      return (
        <>
          <p className="my-2 font-bold">Here's the invite!</p>
          <p className="my-2">Copy this code and send it to {userName}:</p>
          <pre
            className="InvitationCode my-2 p-3 
              border border-gray-200 rounded-md bg-gray-100 
              text-xs whitespace-pre-wrap"
            children={seed}
          />
          <div className="mt-1 text-right">
            <Button
              ref={copyInvitationSeedButton}
              onClick={() => setState('inactive')}
              data-clipboard-text={seed}
            >
              Copy
            </Button>
          </div>
        </>
      )
  }
}

// TODO: style invited members who haven't joined yet

const randomSeed = () => '0000'.replace(/0/g, () => Math.floor(Math.random() * 10).toString())
