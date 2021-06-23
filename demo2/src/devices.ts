export type DeviceInfo = {
  name: string
  emoji: string
}
export const devices = {
  laptop: { name: 'laptop', emoji: '💻' },
  phone: { name: 'phone', emoji: '📱' },
} as Record<string, DeviceInfo>
