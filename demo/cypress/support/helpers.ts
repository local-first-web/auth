export const show = (id: string) => cy.get('.Chooser select').select(id)

export const peer = (userName: string, deviceName: string = 'laptop') =>
  cy.root().findByTitle(`${userName}:${deviceName}`)

export const alice = () => peer('Alice')
export const bob = () => peer('Bob')
export const charlie = () => peer('Charlie')
export const dwight = () => peer('Dwight')

export const alicePhone = () => peer('Alice', 'phone')
export const bobPhone = () => peer('bob', 'phone')
export const charliePhone = () => peer('charlie', 'phone')
export const eve = () => peer('Eve')
export const evePhone = () => peer('Eve', 'phone')

export const aliceToAlice = () => alice().teamMember('Alice')
export const aliceToBob = () => bob().teamMember('Alice')
export const aliceToCharlie = () => charlie().teamMember('Alice')

export const bobToAlice = () => alice().teamMember('Bob')
export const bobToBob = () => bob().teamMember('Bob')
export const bobToCharlie = () => charlie().teamMember('Bob')

export const charlieToAlice = () => alice().teamMember('Charlie')
export const charlieToBob = () => bob().teamMember('Charlie')
export const charlieToCharlie = () => charlie().teamMember('Charlie')
