import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

/**
 * Format a date-only string (YYYY-MM-DD) without timezone conversion.
 * Use for birthday/start_date from DB to avoid off-by-one day in local timezones.
 */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const normalized = typeof dateStr === 'string' ? dateStr.slice(0, 10) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return formatDate(dateStr)
  const [y, m, d] = normalized.split('-').map(Number)
  const dLocal = new Date(y, m - 1, d)
  return dLocal.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
