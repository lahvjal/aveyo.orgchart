import { useState } from 'react'
import {
  Copy, Check, Trash2, ExternalLink, Plus, Loader2,
  Link2, ToggleLeft, ToggleRight, Calendar,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  useProcessShareLinks,
  useCreateProcessShareLink,
  useToggleProcessShareLink,
  useDeleteProcessShareLink,
  type ProcessShareLink,
} from '../../lib/queries'
import { formatDate } from '../../lib/utils'

interface ProcessShareLinkManagerProps {
  processId: string
  processName: string
}

export function ProcessShareLinkManager({ processId, processName }: ProcessShareLinkManagerProps) {
  const { data: links = [], isLoading } = useProcessShareLinks(processId)
  const createLink = useCreateProcessShareLink()
  const toggleLink = useToggleProcessShareLink()
  const deleteLink = useDeleteProcessShareLink()

  const [isCreating, setIsCreating] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const buildUrl = (slug: string) => `${window.location.origin}/share/process/${slug}`

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    // datetime-local gives "YYYY-MM-DDTHH:MM" with no timezone.
    // new Date() treats that as local time; .toISOString() converts to UTC
    // so Supabase stores the moment the user actually intended.
    const expiresAtUtc = expiresAt ? new Date(expiresAt).toISOString() : null
    await createLink.mutateAsync({
      process_id: processId,
      expires_at: expiresAtUtc,
    })
    setExpiresAt('')
    setIsCreating(false)
  }

  const handleCopy = async (link: ProcessShareLink) => {
    await navigator.clipboard.writeText(buildUrl(link.slug))
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleToggle = (link: ProcessShareLink) => {
    toggleLink.mutate({ id: link.id, process_id: processId, is_active: !link.is_active })
  }

  const handleDelete = (link: ProcessShareLink) => {
    if (confirm(`Delete this share link? Anyone using it will immediately lose access.`)) {
      deleteLink.mutate({ id: link.id, process_id: processId })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{processName}</p>
          <p className="text-xs text-muted-foreground">Anyone with a link can view this diagram without logging in</p>
        </div>
      </div>

      {/* Create form */}
      {isCreating ? (
        <form onSubmit={handleCreate} className="space-y-3 p-3 bg-muted/40 rounded-lg border">
          <div className="space-y-1.5">
            <Label htmlFor="expires_at" className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Expiration date (optional)
            </Label>
            <Input
              id="expires_at"
              type="datetime-local"
              value={expiresAt}
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">Leave blank for a link that never expires</p>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createLink.isPending} className="gap-1.5">
              {createLink.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate link
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setIsCreating(false); setExpiresAt('') }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5 w-full">
          <Plus className="h-4 w-4" />
          Generate share link
        </Button>
      )}

      {/* Link list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading links...</span>
        </div>
      ) : links.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">No share links yet</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className={`rounded-lg border p-3 transition-colors ${link.is_active ? 'bg-white' : 'bg-muted/30 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate block">
                    /share/process/{link.slug.slice(0, 16)}…
                  </code>
                  <div className="flex items-center gap-2 flex-wrap">
                    {link.is_active ? (
                      <span className="text-xs font-medium text-green-600">Active</span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">Disabled</span>
                    )}
                    {link.expires_at ? (
                      <span className="text-xs text-muted-foreground">
                        Expires {formatDate(link.expires_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No expiry</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Copy */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleCopy(link)}
                    disabled={!link.is_active}
                    title="Copy link"
                  >
                    {copiedId === link.id
                      ? <Check className="h-3.5 w-3.5 text-green-600" />
                      : <Copy className="h-3.5 w-3.5" />
                    }
                  </Button>

                  {/* Open */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(buildUrl(link.slug), '_blank', 'noopener,noreferrer')}
                    disabled={!link.is_active}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>

                  {/* Toggle active/disabled */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleToggle(link)}
                    disabled={toggleLink.isPending}
                    title={link.is_active ? 'Disable link' : 'Re-enable link'}
                  >
                    {link.is_active
                      ? <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                      : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </Button>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(link)}
                    disabled={deleteLink.isPending}
                    title="Delete link permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground pt-1 border-t">
        Disabling a link immediately revokes access. Deleting it is permanent.
        Employee and department details are never visible to public viewers.
      </p>
    </div>
  )
}
