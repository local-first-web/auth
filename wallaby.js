module.exports = wallaby => ({
  autoDetect: true,
  runMode: 'onsave',
  slowTestThreshold: 1000,
  lowCoverageThreshold: 99, // 99%
  hints: {
    ignoreCoverageForFile: /ignore file coverage/,
  },
})
