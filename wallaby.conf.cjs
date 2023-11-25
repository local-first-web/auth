module.exports = function (wallaby) {
  return {
    autoDetect: true,

    // runMode: 'onsave',
    // slowTestThreshold: 5000,
    lowCoverageThreshold: 99,
    filesWithoutCoverageCalculated: ['**/util/**/*'],
    hints: {
      ignoreCoverageForFile: /ignore file coverage/,
      ignoreCoverage: /ignore coverage/,
    },
  }
}
