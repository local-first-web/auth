import { UnixTimestamp } from '@localfirst/auth'
import { getShareId } from '@localfirst/auth-provider-automerge-repo'
import ClipboardJS from 'clipboard'
import { MutableRefObject, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { SignOutButton } from './SignOutButton'
import { TeamMembers } from './TeamMembers'

export const TeamAdmin = () => {
  const [state, setState] = useState<State>(SHOW_MEMBERS)
  const [invitationCode, setInvitationCode] = useState<string>()

  const maxUsesSelect = useRef() as MutableRefObject<HTMLSelectElement>
  const expirationSelect = useRef() as MutableRefObject<HTMLSelectElement>

  const { user, team } = useAuth()
  const userBelongsToTeam = team?.has(user.userId)
  const userIsAdmin = userBelongsToTeam && team?.memberIsAdmin(user.userId)

  const copyInvitationCodeButton = useRef() as MutableRefObject<HTMLButtonElement>

  // wire up `Copy` button when there's a code to be copied
  useEffect(() => {
    const c = copyInvitationCodeButton.current
      ? new ClipboardJS(copyInvitationCodeButton.current)
      : undefined

    return () => c?.destroy()
  }, [copyInvitationCodeButton, invitationCode])

  const createInvitationCode = (seed: string) => {
    const shareId = getShareId(team)
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
    setState(SHOW_DEVICE_INVITE)
  }

  switch (state) {
    case SHOW_MEMBERS: {
      // Show team members and invite buttons
      return (
        <>
          <div className="flex flex-col space-y-4">
            {/* Invite & sign out buttons */}
            <div className="flex flex-row space-x-4">
              {/* anyone can "invite" their own devices */}
              <button
                className="button button-primary button-sm"
                onClick={inviteDevice}
                children="Add a device"
              />
              {/* only admins can invite users */}
              {userIsAdmin ? (
                <button
                  className="button button-sm button-primary"
                  onClick={() => setState(INVITING_MEMBERS)}
                  children="Invite members"
                />
              ) : null}
              <SignOutButton />
            </div>

            {/* Member grid */}
            <TeamMembers />
          </div>
        </>
      )
    }

    case SHOW_DEVICE_INVITE: {
      // Display device invitation code
      return (
        <div>
          <h4>Add a device</h4>
          <p>Enter this code on your device.</p>
          <pre
            className="InvitationCode my-2 p-3 border border-gray-200 rounded-md bg-gray-100 text-xs whitespace-pre-wrap"
            children={invitationCode}
          />
          <div className="mt-1 text-right">
            <button
              className="button button-sm button-primary"
              ref={copyInvitationCodeButton}
              onClick={() => setState(SHOW_MEMBERS)}
              data-clipboard-text={invitationCode}
              children="Copy"
            />
          </div>
        </div>
      )
    }

    case INVITING_MEMBERS: {
      // Display options for creating an invitation for a new member
      return (
        <div>
          <h4>Invite members</h4>
          <div className="flex flex-col gap-4 mt-4">
            <label>
              How many people can use this invitation code?
              <select
                ref={maxUsesSelect}
                className="mt-1 w-full border border-gray-200 rounded-md p-2 text-sm"
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
                defaultValue={HOUR}
                className="mt-1 w-full border border-gray-200 rounded-md p-2 text-sm"
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
                    setState(SHOW_MEMBERS)
                  }}
                  children="Cancel"
                />
              </div>
              <div>
                <button
                  className="InviteButton button button-sm button-primary mt-1"
                  onClick={inviteMembers}
                  children="Invite"
                />
              </div>
            </div>
          </div>
        </div>
      )
    }

    case SHOWING_MEMBER_INVITE: {
      // Display invitation code for new member
      return (
        <>
          <p className="my-2 font-bold">Here's the invite!</p>
          <p>Send this code to whoever you want to invite.</p>
          <pre
            className="my-2 p-3 border border-gray-200 rounded-md bg-gray-100 text-xs whitespace-pre-wrap"
            children={invitationCode}
          />
          <div className="mt-1 text-right">
            <button
              className="button button-sm button-primary"
              ref={copyInvitationCodeButton}
              onClick={() => setState(SHOW_MEMBERS)}
              data-clipboard-text={invitationCode}
              children="Copy"
            />
          </div>
        </>
      )
    }

    default: {
      return null
    }
  }
}

const SECOND = 1
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

const SHOW_MEMBERS = 'SHOW_MEMBERS'
const SHOW_DEVICE_INVITE = 'SHOW_DEVICE_INVITE'
const INVITING_MEMBERS = 'INVITING_MEMBERS'
const SHOWING_MEMBER_INVITE = 'SHOWING_MEMBER_INVITE'

type State =
  | typeof SHOW_MEMBERS
  | typeof SHOW_DEVICE_INVITE
  | typeof INVITING_MEMBERS
  | typeof SHOWING_MEMBER_INVITE
