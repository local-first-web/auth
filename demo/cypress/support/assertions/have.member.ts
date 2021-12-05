import '@testing-library/cypress/add-commands'

chai.Assertion.addMethod('member', function(userName: string) {
  const $element = this._obj
  new chai.Assertion($element).to.have

  const memberRow = $element.find(`.MemberTable tr:contains('${userName}')`)

  // admins see a button
  const memberExists = memberRow.length === 1

  this.assert(
    memberExists,
    `expected to have member ${userName}`,
    `expected not to have member ${userName}`,
    true,
    false
  )
})
