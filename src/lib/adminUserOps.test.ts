import { describe, expect, it } from 'vitest'
import { getAdminErrorMessage } from './adminUserOps'

describe('getAdminErrorMessage', () => {
  it('maps known authz codes to actionable text', () => {
    const msg = getAdminErrorMessage(
      { code: 'AUTHZ_SCOPE_DENIED', error: 'raw', requestId: 'req-123' },
      null,
      'fallback'
    )

    expect(msg).toContain('permission')
    expect(msg).toContain('req-123')
  })

  it('uses fallback when payload has no useful message', () => {
    const msg = getAdminErrorMessage({}, null, 'Fallback message')
    expect(msg).toBe('Fallback message')
  })

  it('prefers mapped message from error body/code', () => {
    const msg = getAdminErrorMessage(
      null,
      {
        message: 'Request failed',
        status: 403,
        code: 'AUTHZ_FIELD_DENIED',
        body: { code: 'AUTHZ_FIELD_DENIED' },
      }
    )

    expect(msg).toContain('permission')
  })
})
