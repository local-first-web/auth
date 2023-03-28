// ignore file coverage
expect.extend({
  toLookLikeKeyset(maybeKeyset: any) {
    const looksLikeKeyset = maybeKeyset.hasOwnProperty('encryption') && maybeKeyset.hasOwnProperty('signature')
    if (looksLikeKeyset)
      return {
        message: () => 'expected not to look like a keyset',
        pass: true,
      }
    else
      return {
        message: () => 'expected to look like a keyset',
        pass: false,
      }
  },
})
