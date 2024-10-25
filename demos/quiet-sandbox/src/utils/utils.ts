export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export type ReplacerFunc<T> = (originalValue: any) => T
export type ReplacerConfig<T> = { newValue?: T, replacerFunc?: ReplacerFunc<T> }
export type KeyValueReplacerConfig<T> = { key: string, replace: ReplacerConfig<T> }
export type ReplacerMap = Map<string, ReplacerFunc<any>>

const getReplacerForKey = <T>({ key, replace }: KeyValueReplacerConfig<T>): ReplacerFunc<T> => {
  if (replace.newValue == null && replace.replacerFunc == null) {
    throw new Error(`Must provide a replacement value or a replacement function!`)
  }

  const replacerFunc = replace.newValue != null ? (originalValue: any): T => replace.newValue! : replace.replacerFunc!
  return replacerFunc
}

const populateReplacerFuncs = (replacers: KeyValueReplacerConfig<any>[]): ReplacerMap => {
  const replacerMap: ReplacerMap = new Map()
  for (const replacerConfig of replacers) {
    replacerMap.set(replacerConfig.key, getReplacerForKey(replacerConfig))
  }

  return replacerMap
}

export const findAllByKeyAndReplace = (object: any, replacers: KeyValueReplacerConfig<any>[]) => {
  const replacerMap = populateReplacerFuncs(replacers)
  const newObject = { ...object }
  const looper = (obj: any) => {
    for (let k in obj){
      if(replacerMap.has(k)){
        obj[k] = replacerMap.get(k)!(obj[k])
      }
      if(typeof obj[k] === "object"){
        looper(obj[k])
      }
    }
  }
  looper(newObject)

  return newObject
}