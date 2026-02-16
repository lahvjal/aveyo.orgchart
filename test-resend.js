// Test script to verify Resend is working
// Run this in browser console to test Resend directly

import { Resend } from 'resend'

const resendApiKey = import.meta.env.VITE_RESEND_API_KEY
const fromEmail = import.meta.env.VITE_FROM_EMAIL

console.log('Testing Resend Configuration:')
console.log('API Key exists:', !!resendApiKey)
console.log('API Key starts with "re_":', resendApiKey?.startsWith('re_'))
console.log('From Email:', fromEmail)

if (!resendApiKey) {
  console.error('❌ VITE_RESEND_API_KEY is not set!')
  console.log('Please add it to .env.local and restart the dev server')
} else if (!resendApiKey.startsWith('re_')) {
  console.error('❌ VITE_RESEND_API_KEY looks invalid (should start with "re_")')
} else {
  console.log('✅ Resend configuration looks correct')
  
  // Test Resend initialization
  try {
    const resend = new Resend(resendApiKey)
    console.log('✅ Resend client initialized successfully')
    
    // Uncomment to send a test email:
    /*
    console.log('Sending test email...')
    const result = await resend.emails.send({
      from: fromEmail,
      to: ['your-test-email@example.com'], // Change this!
      subject: 'Test Email from Org Chart App',
      html: '<p>This is a test email to verify Resend is working!</p>',
    })
    console.log('✅ Test email sent:', result)
    */
  } catch (error) {
    console.error('❌ Error with Resend:', error)
  }
}
