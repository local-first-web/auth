import { Team, TacoOptions } from 'Team'

export const create = (options: TacoOptions) => {
  return new Team(options)
}

export const load = (json: any, options: TacoOptions) => {
  return new Team({
    ...options,
    source: json,
  })
}
