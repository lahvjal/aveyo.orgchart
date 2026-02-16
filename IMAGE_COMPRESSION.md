# Image Compression for Profile Photos

## Overview

Automatic image compression has been implemented for profile photo uploads. Images larger than 5MB are automatically compressed to approximately 4.5MB before uploading to Supabase Storage.

## How It Works

### Compression Process

1. **File Validation**: Images up to 10MB are accepted
2. **Automatic Compression**: Files > 5MB are automatically compressed to ~4.5MB
3. **Quality Optimization**: Uses an iterative algorithm to find the optimal quality setting
4. **Smart Resizing**: Maintains aspect ratio while limiting maximum dimension to 2048px
5. **Upload**: Compressed (or original if < 5MB) file is uploaded to Supabase Storage

### Technical Details

**File: `src/lib/imageCompression.ts`**

The compression utility provides:

- **Canvas-based compression**: Uses HTML5 Canvas API for client-side processing
- **Quality iteration**: Attempts up to 5 compressions to hit target size within 10% tolerance
- **Smart quality calculation**: Starts with estimated quality based on compression ratio
- **High-quality smoothing**: Uses `imageSmoothingQuality: 'high'` for better results
- **Format preservation**: Maintains PNG or JPEG format from original

### Compression Algorithm

```javascript
1. Check if file > 5MB
2. If yes:
   - Load image into memory
   - Calculate new dimensions (max 2048px)
   - Draw to canvas at new size
   - Calculate initial quality based on size ratio
   - Iterate to find optimal quality:
     - Compress with current quality
     - Check if within 10% of 4.5MB target
     - Adjust quality up/down as needed
     - Retry (max 5 attempts)
3. Upload final file
```

## User Experience

### Visual Feedback

- **"Compressing image..."**: Shows while compression is in progress
- **"Uploading..."**: Shows during Supabase Storage upload
- **Camera button disabled**: During compression and upload

### File Size Limits

- **Before compression**: Max 10MB accepted
- **After compression**: Target ~4.5MB for files > 5MB
- **Small files**: Files < 5MB upload without compression

## Examples

### Scenario 1: Large Image (8MB)
```
1. User selects 8MB photo
2. System shows "Compressing image..."
3. Compresses 8MB → 4.5MB (takes ~1-2 seconds)
4. System shows "Uploading..."
5. Uploads 4.5MB file to Supabase
6. Success!
```

### Scenario 2: Medium Image (3MB)
```
1. User selects 3MB photo
2. No compression needed
3. System shows "Uploading..."
4. Uploads original 3MB file
5. Success!
```

### Scenario 3: Very Large Image (12MB)
```
1. User selects 12MB photo
2. Error: "Image must be less than 10 MB"
3. User must resize/compress externally first
```

## Implementation Files

### Core Compression Logic
- **`src/lib/imageCompression.ts`**: Main compression utility with iterative quality optimization

### UI Integration
- **`src/components/profile/PhotoUpload.tsx`**: Photo upload component with compression integration

## Benefits

1. **Reduced storage costs**: Smaller files = less Supabase Storage usage
2. **Faster uploads**: Compressed files upload more quickly
3. **Better performance**: Smaller images load faster in the UI
4. **Automatic**: No user action required - happens seamlessly
5. **Quality maintained**: Smart compression preserves visual quality

## Browser Compatibility

Uses standard HTML5 Canvas API, supported by all modern browsers:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Mobile browsers: ✅

## Testing

To test the compression:

1. Go to Profile page
2. Click camera icon on avatar
3. Select a large image (> 5MB)
4. Watch console for compression logs:
   ```
   Original file size: 8.2 MB
   Attempt 1: Quality 0.65, Size 4.8 MB
   Attempt 2: Quality 0.62, Size 4.6 MB
   Compression complete: 4.6MB (quality: 0.62)
   Compressed file size: 4.6 MB
   ```
5. Image uploads successfully

## Configuration

Current settings in `PhotoUpload.tsx`:

```typescript
compressImage(file, {
  maxSizeMB: 5,           // Compress files larger than this
  targetSizeMB: 4.5,      // Target size after compression
  maxWidthOrHeight: 2048, // Max dimension
})
```

To adjust these values, modify the options passed to `compressImage()`.

## Future Enhancements

Possible improvements:

1. **WebP conversion**: Convert to WebP format for even better compression
2. **Progressive compression**: Show compression progress bar
3. **Client-side preview**: Show before/after comparison
4. **Configurable targets**: Let admins configure compression settings
5. **Batch compression**: Compress multiple images at once
