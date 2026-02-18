import { useState, useRef } from 'react'
import { Camera } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { getInitials } from '../../lib/utils'
import { uploadProfilePhoto } from '../../lib/queries'
import { compressImage, formatFileSize } from '../../lib/imageCompression'
import { ImageCropDialog } from './ImageCropDialog'

interface PhotoUploadProps {
  currentPhotoUrl: string | null
  userName: string
  userId: string
  onPhotoUploaded: (url: string) => void
  size?: 'sm' | 'lg'
}

export function PhotoUpload({ currentPhotoUrl, userName, userId, onPhotoUploaded, size = 'lg' }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
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

    // Create a preview URL for the cropping dialog
    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result as string)
      setShowCropDialog(true)
    }
    reader.onerror = () => {
      setError('Failed to read image file')
    }
    reader.readAsDataURL(file)

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = async (croppedFile: File) => {
    setShowCropDialog(false)
    setImageToCrop(null)

    try {
      let fileToUpload = croppedFile

      // Compress if larger than 2.5MB
      if (croppedFile.size > 2.5 * 1024 * 1024) {
        setCompressing(true)
        console.log(`Original file size: ${formatFileSize(croppedFile.size)}`)
        
        fileToUpload = await compressImage(croppedFile, {
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

  const isSmall = size === 'sm'

  return (
    <div className={isSmall ? 'flex flex-col items-center gap-1' : 'flex flex-col items-center gap-4'}>
      <div className="relative">
        <Avatar className={isSmall ? 'h-[60px] w-[60px]' : 'h-32 w-32'}>
          {currentPhotoUrl && (
            <AvatarImage src={currentPhotoUrl} alt={userName} />
          )}
          <AvatarFallback className={isSmall ? '' : 'text-2xl'}>
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
        
        <Button
          type="button"
          size="icon"
          className={isSmall
            ? 'absolute -bottom-1 -right-1 rounded-full h-5 w-5'
            : 'absolute bottom-0 right-0 rounded-full'}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || compressing}
        >
          <Camera className={isSmall ? 'h-3 w-3' : 'h-4 w-4'} />
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

      {!isSmall && compressing && (
        <p className="text-sm text-muted-foreground">Compressing image...</p>
      )}

      {!isSmall && uploading && (
        <p className="text-sm text-muted-foreground">Uploading...</p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {imageToCrop && (
        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={(open) => {
            setShowCropDialog(open)
            if (!open) {
              // Clean up when dialog closes
              setImageToCrop(null)
            }
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}
