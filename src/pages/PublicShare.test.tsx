import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicShare from './PublicShare'

const mockUsePublicOrgShareBundle = vi.fn()

vi.mock('../lib/queries', () => ({
  usePublicOrgShareBundle: (slug: string) => mockUsePublicOrgShareBundle(slug),
}))

vi.mock('../components/org-chart/OrgChartCanvas', () => ({
  OrgChartCanvas: ({ profiles }: { profiles: Array<{ id: string }> }) => (
    <div data-testid="org-chart-canvas">Profiles: {profiles.length}</div>
  ),
}))

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/share/public-slug']}>
      <Routes>
        <Route path="/share/:slug" element={<PublicShare />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PublicShare', () => {
  beforeEach(() => {
    mockUsePublicOrgShareBundle.mockReset()
  })

  it('shows a loading state while bundle is fetching', () => {
    mockUsePublicOrgShareBundle.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    })

    renderPage()
    expect(screen.getByText('Loading org chart...')).toBeInTheDocument()
  })

  it('shows not found state when share bundle is unavailable', () => {
    mockUsePublicOrgShareBundle.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('missing'),
    })

    renderPage()
    expect(screen.getByText('Link Not Found')).toBeInTheDocument()
  })

  it('renders using minimal public profile payload', () => {
    mockUsePublicOrgShareBundle.mockReturnValue({
      data: {
        share_link: {
          slug: 'public-slug',
          root_profile_id: 'root-1',
          include_contact_info: false,
          expires_at: null,
        },
        profiles: [
          {
            id: 'root-1',
            email: '',
            full_name: 'Alice Example',
            job_title: 'Chief Executive Officer',
            profile_photo_url: null,
            phone: null,
            location: null,
            social_links: {},
            department_id: null,
            manager_id: null,
            department: null,
          },
        ],
      },
      isLoading: false,
      error: null,
    })

    renderPage()

    expect(screen.getByText('Organization Chart')).toBeInTheDocument()
    expect(screen.getByTestId('org-chart-canvas')).toHaveTextContent('Profiles: 1')
    expect(screen.getByText('Contact information is hidden')).toBeInTheDocument()
  })
})
