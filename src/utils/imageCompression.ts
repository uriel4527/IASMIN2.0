// Utility for image compression with enhanced error handling and multi-stage compression
export interface CompressedImage {
  compressedFile: Blob;
  base64: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  finalSizeKB: number;
}

export interface CompressionLevel {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  name: string;
}

// Progressive compression levels for different scenarios
export const COMPRESSION_LEVELS: CompressionLevel[] = [
  { maxWidth: 800, maxHeight: 600, quality: 0.8, name: 'light' },    // First attempt
  { maxWidth: 600, maxHeight: 450, quality: 0.6, name: 'medium' },   // Second attempt
  { maxWidth: 400, maxHeight: 300, quality: 0.4, name: 'heavy' },    // Third attempt
  { maxWidth: 300, maxHeight: 200, quality: 0.2, name: 'ultra' },    // Final attempt
];

// Maximum allowed size in KB for base64 in database (considering 33% base64 overhead)
const MAX_SIZE_KB = 200; // Conservative limit to avoid 413 errors
const MAX_SIZE_BYTES = MAX_SIZE_KB * 1024;

export const compressImage = async (
  file: File, 
  maxWidth: number = 800, 
  maxHeight: number = 600, 
  quality: number = 0.7,
  targetSizeKB?: number
): Promise<CompressedImage> => {
  const targetSize = targetSizeKB ? targetSizeKB * 1024 : MAX_SIZE_BYTES;
  
  console.log('🔧 Starting image compression:', {
    fileName: file.name,
    originalSize: file.size,
    targetSizeKB: Math.round(targetSize / 1024),
    maxWidth,
    maxHeight,
    quality
  });

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Use better image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const finalSizeKB = Math.round(blob.size / 1024);
            console.log('📊 Compression result:', {
              originalSize: Math.round(file.size / 1024) + 'KB',
              compressedSize: finalSizeKB + 'KB',
              dimensions: `${width}x${height}`,
              quality,
              withinLimit: blob.size <= targetSize
            });

            // Convert to base64 for database storage
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const base64SizeKB = Math.round(base64.length * 0.75 / 1024); // Approximate base64 size
              
              console.log('✅ Base64 conversion complete:', {
                base64Length: base64.length,
                estimatedSizeKB: base64SizeKB
              });
              
              resolve({
                compressedFile: blob,
                base64,
                originalSize: file.size,
                compressedSize: blob.size,
                compressionRatio: Math.round(((file.size - blob.size) / file.size * 100) * 100) / 100,
                finalSizeKB
              });
            };
            reader.onerror = () => reject(new Error('Failed to convert to base64'));
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        console.error('🚫 Canvas processing error:', error);
        reject(new Error('Failed to process image on canvas'));
      }
    };

    img.onerror = (error) => {
      console.error('🚫 Image load error:', error);
      reject(new Error('Failed to load image file'));
    };
    
    // Create object URL and set up cleanup
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    
    // Cleanup object URL after image loads or fails
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const originalOnLoad = img.onload;
    const originalOnError = img.onerror;
    
    img.onload = () => {
      if (originalOnLoad) originalOnLoad.call(img, new Event('load'));
      cleanup();
    };
    img.onerror = (error) => {
      if (originalOnError) originalOnError.call(img, error);
      cleanup();
    };
  });
};

// Multi-stage compression with automatic quality reduction
export const compressImageProgressive = async (file: File): Promise<CompressedImage> => {
  console.log('🚀 Starting progressive compression for:', file.name);
  
  for (let i = 0; i < COMPRESSION_LEVELS.length; i++) {
    const level = COMPRESSION_LEVELS[i];
    console.log(`📐 Trying compression level ${i + 1}/${COMPRESSION_LEVELS.length}: ${level.name}`);
    
    try {
      const result = await compressImage(
        file, 
        level.maxWidth, 
        level.maxHeight, 
        level.quality
      );
      
      // Check if result meets size requirements
      if (result.compressedSize <= MAX_SIZE_BYTES) {
        console.log(`✅ Compression successful at level: ${level.name}`);
        return result;
      } else {
        console.log(`⚠️ Level ${level.name} still too large: ${result.finalSizeKB}KB, trying next level...`);
      }
    } catch (error) {
      console.error(`❌ Compression failed at level ${level.name}:`, error);
      
      // If this is the last level, throw the error
      if (i === COMPRESSION_LEVELS.length - 1) {
        throw error;
      }
    }
  }
  
  throw new Error(`Unable to compress image to under ${MAX_SIZE_KB}KB after all attempts`);
};

export const validateImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB max

  return validTypes.includes(file.type) && file.size <= maxSize;
};