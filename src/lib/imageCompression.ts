/**
 * Image compression utility for profile photos
 * Compresses images larger than 5MB to approximately 4.5MB
 */

interface CompressionOptions {
  maxSizeMB: number
  targetSizeMB: number
  maxWidthOrHeight?: number
  useWebWorker?: boolean
}

/**
 * Compresses an image file if it exceeds the maximum size
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed file or original if under max size
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {
    maxSizeMB: 5,
    targetSizeMB: 4.5,
    maxWidthOrHeight: 2048,
  }
): Promise<File> {
  const fileSizeMB = file.size / 1024 / 1024

  // If file is already under max size, return as-is
  if (fileSizeMB <= options.maxSizeMB) {
    console.log(`Image size (${fileSizeMB.toFixed(2)}MB) is within limit, no compression needed`)
    return file
  }

  console.log(`Compressing image from ${fileSizeMB.toFixed(2)}MB to ~${options.targetSizeMB}MB`)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = img
          const maxDimension = options.maxWidthOrHeight || 2048

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension
              width = maxDimension
            } else {
              width = (width / height) * maxDimension
              height = maxDimension
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          // Use high-quality image smoothing
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)

          // Start with a quality that should get us close to target
          const compressionRatio = options.targetSizeMB / fileSizeMB
          let quality = Math.max(0.5, Math.min(0.95, compressionRatio * 1.2))

          // Try to compress to target size
          attemptCompression(canvas, file, quality, options.targetSizeMB, resolve, reject)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Attempts to compress the canvas to a blob with the target size
 */
function attemptCompression(
  canvas: HTMLCanvasElement,
  originalFile: File,
  quality: number,
  targetSizeMB: number,
  resolve: (file: File) => void,
  reject: (error: Error) => void,
  attempts: number = 0
): void {
  const maxAttempts = 5

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob from canvas'))
        return
      }

      const blobSizeMB = blob.size / 1024 / 1024

      console.log(`Attempt ${attempts + 1}: Quality ${quality.toFixed(2)}, Size ${blobSizeMB.toFixed(2)}MB`)

      // If we're within 10% of target or at max attempts, accept it
      const tolerance = targetSizeMB * 0.1
      if (
        Math.abs(blobSizeMB - targetSizeMB) <= tolerance ||
        attempts >= maxAttempts ||
        blobSizeMB <= targetSizeMB
      ) {
        // Create a new File from the blob
        const compressedFile = new File([blob], originalFile.name, {
          type: blob.type,
          lastModified: Date.now(),
        })

        console.log(`Compression complete: ${blobSizeMB.toFixed(2)}MB (quality: ${quality.toFixed(2)})`)
        resolve(compressedFile)
        return
      }

      // Adjust quality and try again
      if (blobSizeMB > targetSizeMB) {
        // File is too large, reduce quality
        quality *= 0.9
      } else {
        // File is too small, increase quality slightly
        quality *= 1.05
      }

      quality = Math.max(0.1, Math.min(0.95, quality))
      attemptCompression(canvas, originalFile, quality, targetSizeMB, resolve, reject, attempts + 1)
    },
    originalFile.type === 'image/png' ? 'image/png' : 'image/jpeg',
    quality
  )
}

/**
 * Validates if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Gets human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
