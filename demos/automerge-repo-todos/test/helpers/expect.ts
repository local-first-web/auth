/* eslint-disable @typescript-eslint/no-inferrable-types */
import { expect as baseExpect, type Page } from '@playwright/test'
import { pause } from '@localfirst/auth-shared'

export const expect = baseExpect.extend({
  async toBeLoggedIn(page: Page, name: string = 'Herb') {
    const firstCell = page.getByRole('cell')
    const userNameText = firstCell.getByText(name)
    await userNameText.click()
    const check = await userNameText.isVisible()

    if (check) {
      return {
        message: () => 'user is logged in',
        pass: true,
      }
    }

    return {
      message: () => `user is not logged in`,
      pass: false,
    }
  },
})
