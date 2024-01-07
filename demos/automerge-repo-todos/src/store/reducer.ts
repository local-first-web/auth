import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type * as Auth from '@localfirst/auth'
import type { ShareId } from '@localfirst/auth-provider-automerge-repo'
import type { DocumentId } from '@automerge/automerge-repo'
import { initialState } from './initialState'

export const { reducer, actions } = createSlice({
  name: 'reducer',
  initialState,
  reducers: {
    setUserName(state, action: PayloadAction<string>) {
      state.userName = action.payload
    },

    setDevice(state, action: PayloadAction<Auth.DeviceWithSecrets>) {
      state.device = action.payload
    },

    setUser(state, action: PayloadAction<Auth.UserWithSecrets>) {
      state.user = action.payload
    },

    setTeamId(state, action: PayloadAction<ShareId>) {
      state.teamId = action.payload
    },

    setRootDocumentId(state, action: PayloadAction<DocumentId>) {
      state.rootDocumentId = action.payload
    },

    /**
     * Provided for debugging purposes - in normal use this would basically never happen, as it
     * would require the user to re-authorize the device from another device.
     */
    logout(state) {
      state.userName = undefined
      state.device = undefined
      state.user = undefined
      state.teamId = undefined
      state.rootDocumentId = undefined
    },
  },
})
