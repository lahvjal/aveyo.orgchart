import { useParams } from 'react-router-dom'
import { AlertCircle, Eye, Calendar } from 'lucide-react'
import { usePublicProcessShareLink, useOrganizationSettings } from '../lib/queries'
import { useProcess, useProcessNodes, useProcessEdges } from '../hooks/useProcesses'
import { ProcessCanvas } from '../components/processes/ProcessCanvas'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading process diagram...</p>
      </div>
    </div>
  )
}

function ErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="p-8 max-w-md w-full text-center shadow-lg">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Link Not Available</h2>
        <p className="text-muted-foreground">
          This link is invalid, has expired, or has been revoked.
        </p>
      </Card>
    </div>
  )
}

export default function PublicProcessView() {
  const { slug } = useParams<{ slug: string }>()

  const {
    data: shareLink,
    isLoading: linkLoading,
    isFetched: linkFetched,
    error: linkError,
  } = usePublicProcessShareLink(slug!)


  const processId = shareLink?.process_id ?? null

  // All hooks must be called unconditionally before any early returns
  const { data: process, isLoading: processLoading } = useProcess(processId)
  const { data: orgSettings } = useOrganizationSettings()
  useProcessNodes(processId)
  useProcessEdges(processId)

  if (linkLoading || (shareLink && processLoading)) {
    return <LoadingScreen />
  }

  if (linkError || (linkFetched && !shareLink)) {
    return <ErrorScreen />
  }

  if (!shareLink || !process) {
    return <LoadingScreen />
  }

  const expiresAt = shareLink.expires_at ? new Date(shareLink.expires_at) : null

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo + process name */}
            <div className="flex items-center gap-3 min-w-0">
              {orgSettings?.logo_url && (
                <img
                  src={orgSettings.logo_url}
                  alt="Company logo"
                  className="h-8 w-auto object-contain flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900 truncate">{process.name}</h1>
                  <Badge variant="secondary" className="gap-1 text-xs shrink-0">
                    <Eye className="h-3 w-3" />
                    Read only
                  </Badge>
                </div>
                {process.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground truncate">{process.description}</p>
                )}
              </div>
            </div>

            {expiresAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Calendar className="h-3.5 w-3.5" />
                <span>Expires {expiresAt.toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Canvas — explicit calc height mirrors how PublicShare.tsx handles ReactFlow */}
      <div className="h-[calc(100vh-7rem)] p-3">
        <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
          <ProcessCanvas processId={processId!} canEdit={false} isPublic />
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-t py-2">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          Shared process diagram — view only
        </div>
      </footer>
    </div>
  )
}
