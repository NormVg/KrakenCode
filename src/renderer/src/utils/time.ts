/**
 * Format a timestamp as a relative "last used" string.
 *
 * Returns compact relative time: "just now", "5m ago", "3h ago",
 * "2d ago", or a short date for older items.
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 30) return 'just now'
  if (minutes < 1) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  // Older than a week — show compact date
  const date = new Date(timestamp)
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  return `${month} ${day}`
}
