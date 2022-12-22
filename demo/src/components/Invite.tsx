import { Button, Label, Select } from '@windmill/react-ui'
import ClipboardJS from 'clipboard'
import React, { MutableRefObject, useEffect, useRef, useState } from 'react'
import { useTeam } from '../hooks/useTeam'
import { assert } from '../util/assert'

const SECOND = 1
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export const Invite = () => {
  type State = 'inactive' | 'adding_device' | 'inviting_members' | 'showing_member_invite'

  const [state, setState] = useState<State>('inactive')
  const [seed, setSeed] = useState<string>()

  const maxUsesSelect = useRef() as MutableRefObject<HTMLSelectElement>
  const expirationSelect = useRef() as MutableRefObject<HTMLSelectElement>

  const { team, user } = useTeam()
  assert(team)
  assert(user)

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

  const inviteMembers = () => {
    const seed = `${team.teamName}-${randomSeed()}`
    setSeed(seed)

    const maxUses = +maxUsesSelect.current.value
    const now = new Date().getTime()
    const expirationMs = +expirationSelect.current.value * 1000
    const expiration = now + expirationMs

    // TODO we're storing id so we can revoke - wire that up
    const { id } = team.inviteMember({ seed, maxUses, expiration })

    setState('showing_member_invite')
  }

  const inviteDevice = () => {
    const seed = `${team.teamName}-${randomSeed()}`
    setSeed(seed)

    // TODO we're storing id so we can revoke - wire that up
    const { id } = team.inviteDevice({ seed })

    setState('adding_device')
  }

  const userBelongsToTeam = team?.has(user.userId)
  const userIsAdmin = userBelongsToTeam && team?.memberIsAdmin(user.userId)

  switch (state) {
    case 'inactive':
      return (
        <div>
          <div className="Invite flex gap-2">
            {/* anyone can "invite" a device*/}
            <Button size="small" className="my-2 mr-2" onClick={inviteDevice}>
              Add a device
            </Button>
            {/* only admins can invite users */}
            {userIsAdmin ? (
              <Button
                size="small"
                className="my-2 mr-2"
                onClick={() => {
                  setState('inviting_members')
                }}
              >
                Invite members
              </Button>
            ) : null}
          </div>
        </div>
      )

    case 'adding_device':
      return (
        <>
          <h3>Add a device</h3>
          <Label>
            Enter this code on your device to join the team.
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
          </Label>
        </>
      )

    case 'inviting_members':
      return (
        <>
          <h3>Invite members</h3>
          <div className="flex flex-col gap-4 mt-4">
            <Label>
              How many people can use this invitation code?
              <Select ref={maxUsesSelect} className="MaxUses mt-1 w-full" css="">
                <option value={1}>1 person</option>
                <option value={5}>5 people</option>
                <option value={10}>10 people</option>
                <option value={0}>No limit</option>
              </Select>
            </Label>
            <Label>
              When does this invitation code expire?
              <Select
                ref={expirationSelect}
                defaultValue={MINUTE}
                className="Expiration mt-1 w-full"
                css=""
              >
                <option value={SECOND}>in 1 second</option>
                <option value={MINUTE}>in 1 minute</option>
                <option value={HOUR}>in 1 hour</option>
                <option value={DAY}>in 1 day</option>
                <option value={WEEK}>in 1 week</option>
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
                <Button className="InviteButton mt-1" onClick={inviteMembers}>
                  Invite
                </Button>
              </div>
            </div>
          </div>
        </>
      )

    case 'showing_member_invite':
      return (
        <>
          <p className="my-2 font-bold">Here's the invite!</p>
          <Label>
            Copy this code and send it to whoever you want to invite:
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
          </Label>
        </>
      )
  }
}

// TODO: style invited members who haven't joined yet

const randomSeed = () => '0000'.replace(/0/g, () => Math.floor(Math.random() * 10).toString())
