import { Button, CardBody, Input, Label } from '@windmill/react-ui'
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
          <CardBody className="border-r">
            <p>Starting something new?</p>
            <p className="py-2">
              <Button className="w-full" onClick={createTeam}>
                Create team
              </Button>
            </p>
          </CardBody>

          <CardBody>
            <p>Have an invitation?</p>
            <p className="py-2">
              <Button className="w-full" onClick={() => setState('joining')}>
                Join team
              </Button>
            </p>
          </CardBody>
        </div>
      )
    case 'joining':
      const onClickJoin = () => {
        const invitationSeed = invitationSeedInput.current.value // e.g. ambitious-raccoon-1234
        const teamName = invitationSeed
          .split('-')
          .slice(0, 2)
          .join('-') // e.g. ambitious-raccoon
        joinTeam(teamName, invitationSeed)
      }

      return (
        <div className="p-3">
          <p className="my-2">Join team</p>
          <Label>
            <span>Invitation code</span>
            <Input ref={invitationSeedInput} className="my-2 w-full text-black" css="" />
          </Label>
          <div className="text-right">
            <Button className="" onClick={onClickJoin}>
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
