import { useState, useRef, useEffect } from 'react'
import { Camera, Upload, Crop } from 'lucide-react'
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
  const [showEditMenu, setShowEditMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!showEditMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowEditMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEditMenu])

  const handleCameraClick = () => {
    if (currentPhotoUrl) {
      setShowEditMenu((v) => !v)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleUploadNew = () => {
    setShowEditMenu(false)
    fileInputRef.current?.click()
  }

  const handleRecrop = () => {
    setShowEditMenu(false)
    if (currentPhotoUrl) {
      // Append a cache-busting param so the browser fetches a fresh CORS-compliant
      // response instead of serving a cached non-CORS version (which taints the canvas)
      const sep = currentPhotoUrl.includes('?') ? '&' : '?'
      setImageToCrop(`${currentPhotoUrl}${sep}t=${Date.now()}`)
      setShowCropDialog(true)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    const maxSizeBeforeCompression = 10 * 1024 * 1024
    if (file.size > maxSizeBeforeCompression) {
      setError(`Image must be less than ${formatFileSize(maxSizeBeforeCompression)}`)
      return
    }

    setError('')

    const reader = new FileReader()
    reader.onload = () => {
      setImageToCrop(reader.result as string)
      setShowCropDialog(true)
    }
    reader.onerror = () => {
      setError('Failed to read image file')
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = async (croppedFile: File) => {
    setShowCropDialog(false)
    setImageToCrop(null)

    try {
      let fileToUpload = croppedFile

      if (croppedFile.size > 2.5 * 1024 * 1024) {
        setCompressing(true)
        fileToUpload = await compressImage(croppedFile, {
          maxSizeMB: 2.5,
          targetSizeMB: 2,
          maxWidthOrHeight: 2048,
        })
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
      <div className="relative" ref={menuRef}>
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
          onClick={handleCameraClick}
          disabled={uploading || compressing}
        >
          <Camera className={isSmall ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>

        {/* Edit menu — only shown when a photo exists */}
        {showEditMenu && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10 min-w-[180px]">
            <button
              type="button"
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
              onClick={handleUploadNew}
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              Upload new photo
            </button>
            <div className="border-t border-gray-100" />
            <button
              type="button"
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
              onClick={handleRecrop}
            >
              <Crop className="h-4 w-4 text-muted-foreground" />
              Recrop current photo
            </button>
          </div>
        )}
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
            if (!open) setImageToCrop(null)
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}
