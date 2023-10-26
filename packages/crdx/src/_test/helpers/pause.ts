export const pause = async (t = 100) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), t)
  })
