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

export const roles = [
  { "name": "Admin", "description": "Administrator" },
  { "name": "Member", "description": "Verified" },
  { "name": "Developers", "description": "Developer" },
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

export default teamInfo;
