import '@testing-library/cypress/add-commands'

chai.Assertion.addMethod('online', function () {
  const $element = this._obj
  new chai.Assertion($element).to.be
  const $onlineToggle = $element.find('.OnlineToggle')
  const isOnline = $onlineToggle.attr('title') === 'online'
  this.assert(isOnline, 'expected to be online', 'expected not to be online', true, false)
})
