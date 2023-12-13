export const pause = async (t = 0) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), t)
  })
