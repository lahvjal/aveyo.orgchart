import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import type { Area } from 'react-easy-crop'

// Must match the photo area dimensions in EmployeeNode (w-[220px] / h-[150px])
const NODE_PHOTO_ASPECT = 220 / 150

interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  onCropComplete: (croppedFile: File) => void
}

export function ImageCropDialog({ open, onOpenChange, imageSrc, onCropComplete }: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropCompleteCallback = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.src = url
    })

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    fileName: string
  ): Promise<File> => {
    const image = await createImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('No 2d context')
    }

    // Set canvas size to match the cropped area
    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'))
            return
          }
          const file = new File([blob], fileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(file)
        },
        'image/jpeg',
        0.95
      )
    })
  }

  const handleSave = async () => {
    if (!croppedAreaPixels) return

    setProcessing(true)
    try {
      // Extract filename from imageSrc or use a default
      const fileName = `cropped-${Date.now()}.jpg`
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, fileName)
      onCropComplete(croppedFile)
      onOpenChange(false)
      // Reset state
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    } catch (error) {
      console.error('Error cropping image:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    // Reset state
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Crop Your Photo</DialogTitle>
          <DialogDescription>
            Adjust the crop area and zoom — the preview matches exactly how your photo will appear on the org chart
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={NODE_PHOTO_ASPECT}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="rect"
            showGrid={false}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={processing || !croppedAreaPixels}
            >
              {processing ? 'Processing...' : 'Save Cropped Photo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
