module.exports = {
  plugins: [
    [
      'module-resolver',
      {
        root: './',
        alias: { '@': 'src' },
      },
    ],
  ],
}
