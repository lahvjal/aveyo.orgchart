import { useState, useRef } from 'react'
import { useOrganizationSettings, useUpdateOrganizationSettings, uploadOrganizationLogo } from '../../lib/queries'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react'

export function LogoUpload() {
  const { data: settings, isLoading } = useOrganizationSettings()
  const updateSettings = useUpdateOrganizationSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }

    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Please select an image file')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Upload to storage
      const logoUrl = await uploadOrganizationLogo(file)
      
      // Update settings
      await updateSettings.mutateAsync({ logo_url: logoUrl })
      
      // Clear preview and file input
      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setUploading(true)
    setError(null)

    try {
      await updateSettings.mutateAsync({ logo_url: null })
      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove logo')
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const currentLogoUrl = preview || settings?.logo_url

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Logo</CardTitle>
        <CardDescription>
          Upload a logo to replace the default "OrgChart" text in the header. This will be visible to all users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        {/* Current Logo Preview */}
        {currentLogoUrl && (
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex-shrink-0">
              <img
                src={currentLogoUrl}
                alt="Organization logo"
                className="h-16 object-contain"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Current Logo</p>
              <p className="text-xs text-muted-foreground">
                This logo appears in the header for all users
              </p>
            </div>
            {!preview && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
        )}

        {/* Upload Section */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="logo-upload">Upload New Logo</Label>
            <div className="mt-2 flex items-center gap-4">
              <input
                ref={fileInputRef}
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              {fileInputRef.current?.files?.[0] && (
                <span className="text-sm text-muted-foreground">
                  {fileInputRef.current.files[0].name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Supported formats: PNG, JPG, SVG. Max size: 5MB
            </p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-2">Preview</p>
              <img
                src={preview}
                alt="Logo preview"
                className="h-16 object-contain"
              />
            </div>
          )}

          {/* Actions */}
          {preview && (
            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                disabled={uploading}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
