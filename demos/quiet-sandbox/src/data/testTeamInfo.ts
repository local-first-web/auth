

export const channels = [
  { "name": "#general", "description": "General discussion" },
  { "name": "#random", "description": "Random discussion" },
  { "name": "#dev", "description": "Development discussion", "roles": ["Developers"] },
]

export const users = [
  { "name": "Alice", "uuid": "alice" },
  { "name": "Bob", "uuid": "bob" },
  { "name": "Charlie", "uuid": "charlie" },
]

export type Role = {
  name: string,
  description: string,
  members: string[],
}

export const roles = [
  { "name": "Admin", "description": "Administrator", "members": ["Alice"] },
  { "name": "Member", "description": "Verified", "members": ["Bob", "Charlie"] },
  { "name": "Developers", "description": "Developer", "members": ["Alice", "Bob"] },
]

export const invites = [
  { "id": "0", "ttl": "1d", "type": "user"},
  { "id": "1", "ttl": "5m", "type": "device"},
]

export const teamInfo = {
  "name": "Quiet Sandbox",
  "channels": channels,
  "users": users,
  "roles": roles,
  "invites": invites,
}

export type ChannelMessages = {
  [key: string]: Array<{ author: string, content: string }>
}

export const messages: ChannelMessages = {
  "#general": [
    { "author": "Alice", "content": "Alice has created #general." },
    { "author": "Bob", "content": "Bob has joined #general." },
    { "author": "Bob", "content": "Hi everyone!" },
    { "author": "Charlie", "content": "Charlie has joined #general." },
    { "author": "Charlie", "content": "Hello!" },
    { "author": "Alice", "content": "Welcome to #general!" },
  ],
  "#random": [
    { "author": "Alice", "content": "Alice has created #random." },
    { "author": "Bob", "content": "Bob has joined #random." },
    { "author": "Bob", "content": "Hi everyone!" },
    { "author": "Charlie", "content": "Charlie has joined #random." },
    { "author": "Charlie", "content": "Hello!" },
    { "author": "Alice", "content": "Welcome to #random!" },
  ],
  "#dev": [
    { "author": "Alice", "content": "Alice has created #dev." },
    { "author": "Bob", "content": "Bob has joined #dev." },
    { "author": "Bob", "content": "Hi team!" },
    { "author": "Alice", "content": "Welcome to #dev!" },
  ],
}

export default teamInfo;
