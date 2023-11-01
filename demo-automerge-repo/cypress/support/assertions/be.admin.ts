import '@testing-library/cypress/add-commands'

chai.Assertion.addMethod('admin', function () {
  const $element = this._obj
  new chai.Assertion($element).to.be

  // admins see a button
  const $adminButton = $element.find('button:contains("👑")')
  // non-admins just see text
  const $adminSpan = $element.find('span:contains("👑")')

  const isAdmin =
    $adminButton.length > 0
      ? // if the button is not faded out, this member is an admin
        $adminButton.css('opacity') === '1'
      : // if the span exists, this member is an admin
        $adminSpan.length
  this.assert(isAdmin, 'expected to be admin', 'expected not to be admin', true, false)
})
