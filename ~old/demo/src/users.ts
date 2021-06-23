export type UserInfo = {
  name: string
  emoji: string
}

export const users = {
  Alice: { name: 'Alice', emoji: '👩🏾' },
  Bob: { name: 'Bob', emoji: '👨🏻‍🦲' },
  Charlie: { name: 'Charlie', emoji: '👳🏽‍♂️' },
  Dwight: { name: 'Dwight', emoji: '👴' },
  Eve: { name: 'Eve', emoji: '🦹‍♀️' },
} as Record<string, UserInfo>
