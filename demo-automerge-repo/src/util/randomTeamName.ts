import { objects, predicates } from 'friendly-words'
import { randomElement } from './randomElement.js'

export const randomTeamName = (): string => [predicates, objects].map(randomElement).join('-')
