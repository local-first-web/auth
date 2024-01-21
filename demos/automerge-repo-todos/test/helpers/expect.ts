/* eslint-disable @typescript-eslint/no-inferrable-types */
import { pause } from '@localfirst/shared'
import { expect as _expect, type Page } from '@playwright/test'
import { App } from './App'

export const expect = (app: App) => {
  const toSeeMember = async (page: Page, name: string) => {
    const members = app.members()
    try {
      await _expect(members).toContainText(name)
      return {
        message: () => 'user is visible',
        pass: true,
      }
    } catch (e: any) {
      return {
        message: () => `user is not visible`,
        pass: false,
      }
    }
  }
  return _expect.extend({
    toSeeMember,
    toBeLoggedIn: toSeeMember,
  })
}
