module.exports = function (wallaby) {
  return {
    slowTestThreshold: 1000,
    hints: {
      ignoreCoverageForFile: /ignore file coverage/,
    },
  }
}
