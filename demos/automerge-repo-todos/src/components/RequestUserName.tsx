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
      className={cx(['flex flex-col space-y-4 p-4'])}
      onSubmit={e => {
        e.preventDefault()
        submitUserName()
      }}
    >
      <p className="text-center">
        <label htmlFor="userName">Enter your first name to get started:</label>
      </p>
      <div
        className={cx([
          'm-auto',
          'flex flex-col space-y-2',
          'sm:flex-row sm:space-x-2 sm:space-y-0',
        ])}
      >
        <input
          id="userName"
          name="userName"
          type="text"
          autoFocus={true}
          value={userName}
          onChange={e => setUserName(e.target.value)}
          className="textbox-auth flex-grow"
          placeholder=""
        />
        <button
          type="button"
          className="button button-sm button-primary justify-center sm:justify-stretch"
          onClick={submitUserName}
        >
          Continue
        </button>
      </div>
    </form>
  )
}

type Props = {
  onSubmit: (userName: string) => void
}
