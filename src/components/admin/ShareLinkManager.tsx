import { useState } from 'react'
import { useShareLinks, useCreateShareLink, useDeleteShareLink } from '../../lib/queries'
import { useProfiles } from '../../hooks/useProfile'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Plus, Copy, Trash2, ExternalLink, Loader2, Check } from 'lucide-react'
import { formatDate } from '../../lib/utils'

export function ShareLinkManager() {
  const { data: shareLinks, isLoading } = useShareLinks()
  const { data: profiles } = useProfiles()
  const createShareLink = useCreateShareLink()
  const deleteShareLink = useDeleteShareLink()

  const [isCreating, setIsCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    root_profile_id: '',
    include_contact_info: true,
    expires_at: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await createShareLink.mutateAsync({
      root_profile_id: formData.root_profile_id,
      include_contact_info: formData.include_contact_info,
      expires_at: formData.expires_at || null,
    })

    setFormData({
      root_profile_id: '',
      include_contact_info: true,
      expires_at: '',
    })
    setIsCreating(false)
  }

  const handleCopy = async (slug: string, id: string) => {
    const url = `${window.location.origin}/share/${slug}`
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this share link?')) {
      await deleteShareLink.mutateAsync(id)
    }
  }

  if (isLoading) {
    return <div>Loading share links...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Public Share Links</CardTitle>
          <CardDescription>
            Create shareable links for public access to org chart branches
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCreating ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="root_profile">Root Employee *</Label>
                <select
                  id="root_profile"
                  value={formData.root_profile_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, root_profile_id: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select employee</option>
                  {profiles?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name} - {profile.job_title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  The org chart will start from this employee and show their reports
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="include_contact_info"
                  checked={formData.include_contact_info}
                  onChange={(e) => setFormData(prev => ({ ...prev, include_contact_info: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="include_contact_info">Include contact information</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
                <Input
                  id="expires_at"
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createShareLink.isPending}>
                  {createShareLink.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Share Link
              </Button>

              <div className="space-y-2">
                {shareLinks?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No share links created yet
                  </p>
                ) : (
                  shareLinks?.map((link: any) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {link.root_profile?.full_name} - {link.root_profile?.job_title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {link.expires_at
                            ? `Expires ${formatDate(link.expires_at)}`
                            : 'No expiration'}
                        </p>
                        <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">
                          /share/{link.slug}
                        </code>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(link.slug, link.id)}
                          title="Copy link"
                        >
                          {copiedId === link.id ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/share/${link.slug}`, '_blank')}
                          title="Open link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(link.id)}
                          title="Delete link"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
