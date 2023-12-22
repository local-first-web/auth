import { type UnixTimestamp } from '@localfirst/auth'
import ClipboardJS from 'clipboard'
import React, { type MutableRefObject, useEffect, useRef, useState } from 'react'
import { assert } from '@localfirst/auth-shared'
import { Button } from './Button.js'
import { useTeam } from 'hooks/useTeam.js'

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

    const maxUses = Number(maxUsesSelect.current.value)
    const now = Date.now()
    const expirationMs = Number(expirationSelect.current.value) * 1000
    const expiration = (now + expirationMs) as UnixTimestamp

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
    case 'inactive': {
      return (
        <div>
          <div className="Invite flex gap-2">
            {/* anyone can "invite" a device */}
            <Button color="primary" className="my-2 mr-2" onClick={inviteDevice}>
              Add a device
            </Button>
            {/* sonly admins can invite users */}
            {userIsAdmin ? (
              <Button
                color="primary"
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
    }

    case 'adding_device': {
      return (
        <>
          <h3>Add a device</h3>
          <label>
            Enter this code on your device to join the team.
            <pre
              className="InvitationCode my-2 p-3 
              border border-gray-200 rounded-md bg-gray-100 
              text-xs whitespace-pre-wrap"
              children={seed}
            />
            <div className="mt-1 text-right">
              <Button
                color="primary"
                ref={copyInvitationSeedButton}
                onClick={() => setState('inactive')}
                data-clipboard-text={seed}
              >
                Copy
              </Button>
            </div>
          </label>
        </>
      )
    }

    case 'inviting_members': {
      return (
        <>
          <h3>Invite members</h3>
          <div className="flex flex-col gap-4 mt-4">
            <label>
              How many people can use this invitation code?
              <select
                ref={maxUsesSelect}
                className="MaxUses mt-1 w-full border border-gray-200 rounded-md p-2 text-sm"
              >
                <option value={1}>1 person</option>
                <option value={5}>5 people</option>
                <option value={10}>10 people</option>
                <option value={0}>No limit</option>
              </select>
            </label>
            <label>
              When does this invitation code expire?
              <select
                ref={expirationSelect}
                defaultValue={MINUTE}
                className="Expiration mt-1 w-full border border-gray-200 rounded-md p-2 text-sm"
              >
                <option value={SECOND}>in 1 second</option>
                <option value={MINUTE}>in 1 minute</option>
                <option value={HOUR}>in 1 hour</option>
                <option value={DAY}>in 1 day</option>
                <option value={WEEK}>in 1 week</option>
                <option value={0}>Never</option>
              </select>
            </label>

            <div className="flex gap-12">
              <div className="flex-grow">
                <Button
                  className="CancelButton mt-1"
                  onClick={() => {
                    setState('inactive')
                  }}
                >
                  Cancel
                </Button>
              </div>
              <div>
                <Button className="InviteButton mt-1" color="primary" onClick={inviteMembers}>
                  Invite
                </Button>
              </div>
            </div>
          </div>
        </>
      )
    }

    case 'showing_member_invite': {
      return (
        <>
          <p className="my-2 font-bold">Here's the invite!</p>
          <label>
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
                color="primary"
              >
                Copy
              </Button>
            </div>
          </label>
        </>
      )
    }
  }
}

// TODO: style invited members who haven't joined yet

const randomSeed = () => '0000'.replaceAll('0', () => Math.floor(Math.random() * 10).toString())
