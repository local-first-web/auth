import React, { useEffect, useRef, useState } from 'react'
import { useTeam } from '../hooks/useTeam'
import { Button } from './Button'

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
        <div className="CreateOrJoinTeam flex py-4">
          <div className="border-r p-4">
            <p>Starting something new?</p>
            <p className="py-2">
              <Button color="primary" className="w-full justify-center" onClick={createTeam}>
                Create team
              </Button>
            </p>
          </div>

          <div className="p-4">
            <p>Have an invitation?</p>
            <p className="py-2">
              <Button
                color="primary"
                className="w-full justify-center"
                onClick={() => setState('joining')}
              >
                Join team
              </Button>
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
          <h3>Join team</h3>

          <label>
            <span>Invitation code</span>
            <input
              ref={invitationSeedInput}
              className="my-2 w-full text-black border border-gray-400 rounded-md p-2 font-mono text-sm"
            />
          </label>
          <div className="text-right">
            <Button color="primary" onClick={onClickJoin}>
              Join
            </Button>
          </div>
        </div>
      )
    case 'done':
      return null

    default:
      return null
  }
}
