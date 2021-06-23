import '@testing-library/cypress/add-commands'

chai.Assertion.addMethod('admin', function () {
  const $element = this._obj
  new chai.Assertion($element).to.be
  const $adminButton = $element.find('button:contains("👑")')
  const isAdmin = $adminButton.css('opacity') === '1'
  this.assert(isAdmin, 'expected to be admin', 'expected not to be admin', true, false)
})
