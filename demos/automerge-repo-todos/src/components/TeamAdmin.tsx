import { MutableRefObject, useEffect, useRef, useState } from 'react'
import { SignOut } from './SignOut'
import { TeamMembers } from './TeamMembers'
import { UnixTimestamp } from '@localfirst/auth'
import { assert } from '@localfirst/auth-shared'
import { randomKey } from '@localfirst/crypto'
import ClipboardJS from 'clipboard'
import { useAuth } from '../hooks/useAuth'
import { getShareId } from '@localfirst/auth-provider-automerge-repo'

const SECOND = 1
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

const INACTIVE = 'INACTIVE'
const ADDING_DEVICE = 'ADDING_DEVICE'
const INVITING_MEMBERS = 'INVITING_MEMBERS'
const SHOWING_MEMBER_INVITE = 'SHOWING_MEMBER_INVITE'

export const TeamAdmin = () => {
  type State =
    | typeof INACTIVE
    | typeof ADDING_DEVICE
    | typeof INVITING_MEMBERS
    | typeof SHOWING_MEMBER_INVITE

  const [state, setState] = useState<State>(INACTIVE)
  const [_seed, setSeed] = useState<string>()
  const [invitationCode, setInvitationCode] = useState<string>()

  const maxUsesSelect = useRef() as MutableRefObject<HTMLSelectElement>
  const expirationSelect = useRef() as MutableRefObject<HTMLSelectElement>

  const authState = useAuth()
  const { user, team } = authState!
  assert(team)
  assert(user)

  const copyInvitationCodeButton = useRef() as MutableRefObject<HTMLButtonElement>

  // wire up `Copy` button
  useEffect(() => {
    let c: ClipboardJS
    if (copyInvitationCodeButton?.current && invitationCode) {
      c = new ClipboardJS(copyInvitationCodeButton.current)
    }

    return () => {
      c?.destroy()
    }
  }, [copyInvitationCodeButton, invitationCode])

  const createInvitationCode = (seed: string) => {
    const shareId = getShareId(team)
    setSeed(seed)
    setInvitationCode(`${shareId}${seed}`)
  }

  const inviteMembers = () => {
    const maxUses = Number(maxUsesSelect.current.value)
    const now = Date.now()
    const expirationMs = Number(expirationSelect.current.value) * 1000
    const expiration = (now + expirationMs) as UnixTimestamp
    const { seed } = team.inviteMember({ maxUses, expiration })
    createInvitationCode(seed)
    setState(SHOWING_MEMBER_INVITE)
  }

  const inviteDevice = () => {
    const { seed } = team.inviteDevice()
    createInvitationCode(seed)
    setState(ADDING_DEVICE)
  }

  const userBelongsToTeam = team?.has(user.userId)
  const userIsAdmin = userBelongsToTeam && team?.memberIsAdmin(user.userId)

  switch (state) {
    case INACTIVE: {
      return (
        <>
          <div className="flex flex-col space-y-4">
            <div className="flex flex-row space-x-4">
              {/* anyone can "invite" a device */}
              <button className="button button-primary button-sm" onClick={inviteDevice}>
                Add a device
              </button>
              {/* only admins can invite users */}
              {userIsAdmin ? (
                <button
                  className="button button-sm button-primary"
                  onClick={() => {
                    setState(INVITING_MEMBERS)
                  }}
                >
                  Invite members
                </button>
              ) : null}
              <SignOut />
            </div>
            <TeamMembers />
          </div>
        </>
      )
    }

    case ADDING_DEVICE: {
      return (
        <div>
          <h4>Add a device</h4>
          <p>Enter this code on your device.</p>
          <pre
            className="InvitationCode my-2 p-3 
              border border-gray-200 rounded-md bg-gray-100 
              text-xs whitespace-pre-wrap"
            children={invitationCode}
          />
          <div className="mt-1 text-right">
            <button
              className="button button-sm button-primary"
              ref={copyInvitationCodeButton}
              onClick={() => setState(INACTIVE)}
              data-clipboard-text={invitationCode}
            >
              Copy
            </button>
          </div>
        </div>
      )
    }

    case INVITING_MEMBERS: {
      return (
        <div>
          <h4>Invite members</h4>
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
                <button
                  className="CancelButton button button-sm button-white mt-1"
                  onClick={() => {
                    setState(INACTIVE)
                  }}
                >
                  Cancel
                </button>
              </div>
              <div>
                <button
                  className="InviteButton button button-sm button-primary mt-1"
                  onClick={inviteMembers}
                >
                  Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    case SHOWING_MEMBER_INVITE: {
      return (
        <>
          <p className="my-2 font-bold">Here's the invite!</p>
          <p>Send this code to whoever you want to invite.</p>
          <pre
            className="InvitationCode my-2 p-3 
              border border-gray-200 rounded-md bg-gray-100 
              text-xs whitespace-pre-wrap"
            children={invitationCode}
          />
          <div className="mt-1 text-right">
            <button
              className="button button-sm button-primary"
              ref={copyInvitationCodeButton}
              onClick={() => setState(INACTIVE)}
              data-clipboard-text={invitationCode}
            >
              Copy
            </button>
          </div>
        </>
      )
    }

    default: {
      return null
    }
  }
}
