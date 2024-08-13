export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const findAllByKeyAndReplace = (object: any, key: string, replace: { newValue?: any, replacerFunc?: (originalValue: any) => any}) => {
  if (replace.newValue == null && replace.replacerFunc == null) {
    throw new Error(`Must provide a replacement value or a replacement function!`)
  }

  const replacerFunc = replace.newValue ? (originalValue: any) => replace.newValue : replace.replacerFunc!
  
  const newObject = { ...object }
  const looper = (obj: any) => {
    for (let k in obj){
      if(k === key){
        obj[k] = replacerFunc(obj[k])
      }
      else if("object" === typeof obj[k]){
        looper(obj[k])
      }
    }
  }
  looper(newObject)

  return newObject
}