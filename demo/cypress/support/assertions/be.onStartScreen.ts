import '@testing-library/cypress/add-commands'

chai.Assertion.addMethod('onStartScreen', function () {
  const $element = this._obj
  new chai.Assertion($element).to.be
  const isOnStartScreen = $element.find('.CreateOrJoinTeam').length === 1

  this.assert(
    isOnStartScreen,
    'expected to be on start screen',
    'expected not to be on start screen',
    true,
    false
  )
})
