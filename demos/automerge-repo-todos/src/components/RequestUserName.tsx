import cx from 'classnames'
import { useState } from 'react'

export const RequestUserName = ({ onSubmit }: Props) => {
  const [userName, setUserName] = useState<string>('')
  const submitUserName = () => {
    if (userName === undefined || userName.length === 0) return
    onSubmit(userName)
  }

  return (
    <form
      className={cx(['flex flex-col space-y-4 border rounded-md p-6 m-6', 'w-full', 'sm:w-[25em]'])}
      onSubmit={e => {
        e.preventDefault()
        submitUserName()
      }}
    >
      <p className="text-center">
        <label htmlFor="userName">Enter your first name to get started:</label>
      </p>
      <div className={cx(['flex w-full ', 'flex-col space-y-2', 'sm:flex-row sm:space-x-2'])}>
        <input
          id="userName"
          name="userName"
          type="text"
          autoFocus={true}
          value={userName}
          onChange={e => setUserName(e.target.value)}
          className={cx([
            'border py-1 px-3 flex-grow rounded-md font-bold',
            'text-sm',
            'sm:text-base',
          ])}
          placeholder=""
        />
        <button type="button" className="justify-center" onClick={submitUserName}>
          Continue
        </button>
      </div>
    </form>
  )
}

type Props = {
  onSubmit: (userName: string) => void
}
