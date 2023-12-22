import type { SetupCallback } from './FirstUseSetup'

// TODO
export const JoinAsDevice = ({ userName, onSetup }: Props) => {
  return (
    <div>
      <p>Enter your invitation code:</p>
      <input type="text" />
      <button>Join</button>
    </div>
  )
}

type Props = {
  userName: string
  onSetup: SetupCallback
}
