import { useState, useRef } from 'react'
import { Camera } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { getInitials } from '../../lib/utils'
import { uploadProfilePhoto } from '../../lib/queries'
import { compressImage, formatFileSize } from '../../lib/imageCompression'

interface PhotoUploadProps {
  currentPhotoUrl: string | null
  userName: string
  userId: string
  onPhotoUploaded: (url: string) => void
}

export function PhotoUpload({ currentPhotoUrl, userName, userId, onPhotoUploaded }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [compressing, setCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 10MB before compression)
    const maxSizeBeforeCompression = 10 * 1024 * 1024
    if (file.size > maxSizeBeforeCompression) {
      setError(`Image must be less than ${formatFileSize(maxSizeBeforeCompression)}`)
      return
    }

    setError('')

    try {
      let fileToUpload = file

      // Compress if larger than 2.5MB
      if (file.size > 2.5 * 1024 * 1024) {
        setCompressing(true)
        console.log(`Original file size: ${formatFileSize(file.size)}`)
        
        fileToUpload = await compressImage(file, {
          maxSizeMB: 2.5,
          targetSizeMB: 2,
          maxWidthOrHeight: 2048,
        })
        
        console.log(`Compressed file size: ${formatFileSize(fileToUpload.size)}`)
        setCompressing(false)
      }

      setUploading(true)
      const url = await uploadProfilePhoto(fileToUpload, userId)
      onPhotoUploaded(url)
    } catch (err) {
      setError('Failed to upload photo. Please try again.')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      setCompressing(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="h-32 w-32">
          {currentPhotoUrl && (
            <AvatarImage src={currentPhotoUrl} alt={userName} />
          )}
          <AvatarFallback className="text-2xl">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
        
        <Button
          type="button"
          size="icon"
          className="absolute bottom-0 right-0 rounded-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || compressing}
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading || compressing}
      />

      {compressing && (
        <p className="text-sm text-muted-foreground">Compressing image...</p>
      )}

      {uploading && (
        <p className="text-sm text-muted-foreground">Uploading...</p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
