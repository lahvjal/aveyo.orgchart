// Check Environment Variables
// Paste this in your browser console to verify env vars are loaded

console.log('=== Environment Variables Check ===')
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing')
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')
console.log('VITE_SUPABASE_SERVICE_ROLE_KEY:', import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing')
console.log('VITE_RESEND_API_KEY:', import.meta.env.VITE_RESEND_API_KEY ? '✅ Set' : '❌ Missing')
console.log('VITE_FROM_EMAIL:', import.meta.env.VITE_FROM_EMAIL ? '✅ Set' : '❌ Missing')
console.log('VITE_APP_URL:', import.meta.env.VITE_APP_URL ? '✅ Set' : '❌ Missing')

if (!import.meta.env.VITE_RESEND_API_KEY) {
  console.error('⚠️ VITE_RESEND_API_KEY is missing! Did you restart the dev server after adding it to .env.local?')
}
