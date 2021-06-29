import { Button, Label, Select } from '@windmill/react-ui'
import ClipboardJS from 'clipboard'
import React, { MutableRefObject, useEffect, useRef, useState } from 'react'
import { useTeam } from '../hooks/useTeam'
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
  type State = 'inactive' | 'configuring' | 'done'

  const [state, setState] = useState<State>('configuring')
  // const [state, setState] = useState<State>('inactive')
  const [seed, setSeed] = useState<string>()

  const maxUses = useRef() as MutableRefObject<HTMLSelectElement>
  const expiration = useRef() as MutableRefObject<HTMLSelectElement>

  const { team, user } = useTeam()

  const copyInvitationSeedButton = useRef() as MutableRefObject<HTMLButtonElement>

  useEffect(() => {
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

    const seed = `${team.teamName}-${randomSeed()}`
    setSeed(seed)

    // TODO we're storing id so we can revoke - wire that up
    const { id } = team.inviteMember({ seed })

    setState('configuring')
  }

  const userIsAdmin = team?.memberIsAdmin(user.userName)

  switch (state) {
    case 'inactive':
      return (
        <div>
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
                  invite()
                }}
              >
                Invite members
              </Button>
            ) : null}
          </div>
        </div>
      )

    case 'configuring':
      return (
        <>
          <h3>Invite members</h3>
          <div className="flex flex-col gap-4 mt-4">
            <Label>
              <span>How many people can use this invitation code?</span>
              <Select ref={maxUses} className="MaxUses mt-1 w-full" css="">
                <option value={1}>1 person</option>
                <option value={5}>5 people</option>
                <option value={10}>10 people</option>
                <option value={0}>No limit</option>
              </Select>
            </Label>
            <Label>
              <span>When does this invitation code expire?</span>
              <Select ref={expiration} defaultValue={60} className="Expiration mt-1 w-full" css="">
                <option value={1}>in 1 second</option>
                <option value={60}>in 1 minute</option>
                <option value={60 * 60}>in 1 hour</option>
                <option value={24 * 60 * 60}>in 1 day</option>
                <option value={7 * 24 * 60 * 60}>in 1 week</option>
                <option value={0}>Never</option>
              </Select>
            </Label>

            <div className="flex gap-12">
              <div className="flex-grow">
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
              </div>
              <div>
                <Button className="InviteButton mt-1" onClick={invite}>
                  Invite
                </Button>
              </div>
            </div>
          </div>
        </>
      )

    case 'done':
      return (
        <>
          <p className="my-2 font-bold">Here's the invite!</p>
          <p className="my-2">Copy this code and send it to whoever you want to invite:</p>
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
