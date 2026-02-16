import { useParams } from 'react-router-dom'
import { useShareLink } from '../lib/queries'
import { useProfileBranch } from '../hooks/useProfile'
import { OrgChartCanvas } from '../components/org-chart/OrgChartCanvas'
import { Card } from '../components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function PublicShare() {
  const { slug } = useParams<{ slug: string }>()
  const { data: shareLink, isLoading: linkLoading, error: linkError } = useShareLink(slug!)
  const { data: profiles, isLoading: profilesLoading } = useProfileBranch(
    shareLink?.root_profile_id
  )

  if (linkLoading || profilesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading org chart...</p>
        </div>
      </div>
    )
  }

  if (linkError || !shareLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Link Not Found</h2>
          <p className="text-muted-foreground">
            This share link is invalid or has expired.
          </p>
        </Card>
      </div>
    )
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-2">No Data Available</h2>
          <p className="text-muted-foreground">
            This organization chart has no data to display.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Organization Chart</h1>
              <p className="text-sm text-muted-foreground">
                Public view - Read only
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {shareLink.expires_at && (
                <p>
                  Expires: {new Date(shareLink.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Org Chart */}
      <div className="h-[calc(100vh-5rem)] p-4">
        <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
          <OrgChartCanvas
            profiles={profiles}
            isAdmin={false}
            currentUserId={shareLink.root_profile_id}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t py-2">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          {shareLink.include_contact_info
            ? 'Contact information is visible'
            : 'Contact information is hidden'}
        </div>
      </div>
    </div>
  )
}
