import { User } from '/user'
const STORAGE_KEY = 'LF_AUTH_STORAGE'
const USER_STORAGE_KEY = `${STORAGE_KEY}__USER`

const storage = localStorage // TODO - replace with device secure storage e.g. https://github.com/atom/node-keytar, or password-protected browser storage

export const loadUser = (): User | undefined => {
  const serializedUser = storage.getItem(USER_STORAGE_KEY)
  if (serializedUser === null) return undefined
  else return JSON.parse(serializedUser)
}

export const saveUser = (user: User) => {
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}
