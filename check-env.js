// Client environment sanity check.
// Use in the browser console to ensure only browser-safe env vars are exposed.

console.log('=== Client Environment Check ===')
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'set' : 'missing')
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'set' : 'missing')
console.log('VITE_APP_URL:', import.meta.env.VITE_APP_URL ? 'set' : 'missing')

const leaked = [
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_RESEND_API_KEY',
  'VITE_FROM_EMAIL',
].filter((key) => Boolean(import.meta.env[key]))

if (leaked.length > 0) {
  console.error('Sensitive client env vars detected:', leaked)
} else {
  console.log('No sensitive VITE_ secrets detected.')
}
