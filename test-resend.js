// Browser-side security check.
// Resend keys must never be exposed to client code.

const leakedResendKey = import.meta.env.VITE_RESEND_API_KEY

if (leakedResendKey) {
  console.error('Security issue: VITE_RESEND_API_KEY is exposed in client env.')
} else {
  console.log('OK: no client-side Resend key detected.')
}

console.log('Use Supabase edge function logs to validate email delivery:')
console.log('supabase functions logs send-invitation-email')
