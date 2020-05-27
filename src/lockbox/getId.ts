import { KeysetScope } from '/keys'

export const getId = (scope: KeysetScope, name?: string) =>
  name ? `${scope}::${name}` : scope.toString()

export const getScopeAndName = (id: string) => {
  const [scope, name] = id.split('::')
  return { scope, name }
}
