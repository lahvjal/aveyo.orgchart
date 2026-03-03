import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

const mockUseAuth = vi.fn()
const mockUseProfile = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useProfile', () => ({
  useProfile: () => mockUseProfile(),
}))

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset()
    mockUseProfile.mockReset()
  })

  it('redirects unauthenticated users to login', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
    })
    mockUseProfile.mockReturnValue({ data: null, isLoading: false })

    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route
            path="/private"
            element={
              <ProtectedRoute>
                <div>Private Page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('blocks terminated users with archive message', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' },
      loading: false,
      signOut: vi.fn(),
    })
    mockUseProfile.mockReturnValue({
      data: {
        employment_status: 'terminated',
        termination_effective_at: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Private Page</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByText('Account Archived')).toBeInTheDocument()
    expect(screen.queryByText('Private Page')).not.toBeInTheDocument()
  })
})
