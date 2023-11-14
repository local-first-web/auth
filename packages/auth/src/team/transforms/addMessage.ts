import { type Transform } from 'team/types.js'

export const addMessage =
  (message: unknown): Transform =>
  state => ({
    ...state,
    messages: [...state.messages, message],
  })
