import React, { useEffect, useRef, useState } from 'react'
import { useTeam } from '../hooks/useTeam'

export const CreateOrJoinTeam = () => {
  const { joinTeam, createTeam } = useTeam()

  const invitationSeedInput = useRef() as React.MutableRefObject<HTMLInputElement>

  type State = 'inactive' | 'joining' | 'done'
  const [state, setState] = useState<State>('inactive')
  useEffect(() => {
    if (state === 'joining') invitationSeedInput.current?.focus()
  }, [state])

  switch (state) {
    case 'inactive':
      return (
        <div className="CreateOrJoinTeam flex">
          <div className="border-r">
            <p>Starting something new?</p>
            <p className="py-2">
              <button className="w-full" onClick={createTeam}>
                Create team
              </button>
            </p>
          </div>

          <div>
            <p>Have an invitation?</p>
            <p className="py-2">
              <button className="w-full" onClick={() => setState('joining')}>
                Join team
              </button>
            </p>
          </div>
        </div>
      )
    case 'joining':
      const onClickJoin = () => {
        const invitationSeed = invitationSeedInput.current.value // e.g. ambitious-raccoon-1234
        const teamName = invitationSeed.split('-').slice(0, 2).join('-') // e.g. ambitious-raccoon
        joinTeam(teamName, invitationSeed)
      }

      return (
        <div className="p-3">
          <p className="my-2">Join team</p>
          <label>
            <span>Invitation code</span>
            <input ref={invitationSeedInput} className="my-2 w-full text-black" css="" />
          </label>
          <div className="text-right">
            <button className="" onClick={onClickJoin}>
              Join
            </button>
          </div>
        </div>
      )
    case 'done':
      return null

    default:
      return null
  }
}
