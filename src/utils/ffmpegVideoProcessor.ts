/**
 * FFmpeg WASM Video Processor
 * Provides native video trimming without quality loss using FFmpeg
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { CompressedVideoData, TrimData } from './videoCompression';

export class FFmpegVideoProcessor {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  /**
   * Initialize FFmpeg WASM with CDN loading
   */
  async initialize(): Promise<void> {
    if (this.isLoaded || this.isLoading) return;
    
    this.isLoading = true;
    
    try {
      if (!this.ffmpeg) {
        throw new Error('FFmpeg instance not available');
      }

      // Load FFmpeg WASM from CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('✅ FFmpeg loaded successfully');
    } catch (error) {
      console.warn('⚠️ Failed to load FFmpeg:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Check if FFmpeg is available and loaded
   */
  isAvailable(): boolean {
    return this.isLoaded && this.ffmpeg !== null;
  }

  /**
   * Trim video using FFmpeg with intelligent compression for optimal quality/size ratio
   */
  async trimVideo(file: File, trimData: TrimData, qualityMode: 'speed' | 'quality' = 'quality'): Promise<CompressedVideoData> {
    if (!this.isAvailable()) {
      throw new Error('FFmpeg not loaded. Call initialize() first.');
    }

    if (!this.ffmpeg) {
      throw new Error('FFmpeg instance not available');
    }

    try {
      console.log('🎬 Starting FFmpeg intelligent video trim...');
      
      // Write input file to FFmpeg filesystem
      const inputName = 'input.' + this.getFileExtension(file);
      const outputName = 'output.mp4';
      
      await this.ffmpeg.writeFile(inputName, await fetchFile(file));

      // Calculate duration and compression ratio
      const duration = trimData.endTime - trimData.startTime;
      const originalDuration = await this.getVideoDuration(file);
      const trimRatio = duration / originalDuration;
      const expectedSize = file.size * trimRatio;

      console.log(`📊 Original: ${this.formatFileSize(file.size)}, Expected: ${this.formatFileSize(expectedSize)}`);

      // Intelligent CRF selection based on original file size and quality
      let crf: number;
      let preset: string;
      let maxBitrate: string | null = null;

      if (qualityMode === 'quality') {
        // Smart quality mode - balance quality with reasonable file size
        if (file.size < 10 * 1024 * 1024) { // < 10MB
          crf = 20; // High quality
          preset = 'slow';
        } else if (file.size < 50 * 1024 * 1024) { // < 50MB  
          crf = 22; // Good quality
          preset = 'medium';
          maxBitrate = '8M'; // Limit bitrate for large files
        } else { // > 50MB
          crf = 24; // Balanced quality
          preset = 'fast';
          maxBitrate = '6M';
        }
      } else {
        // Speed mode - prioritize fast processing
        crf = 26;
        preset = 'faster';
        maxBitrate = '4M';
      }

      // Build FFmpeg arguments with intelligent compression
      const args = [
        '-i', inputName,
        '-ss', trimData.startTime.toString(),
        '-t', duration.toString(),
        // Video encoding with intelligent quality
        '-c:v', 'libx264',
        '-preset', preset,
        '-crf', crf.toString(),
        '-pix_fmt', 'yuv420p',
      ];

      // Add bitrate limit for larger files
      if (maxBitrate) {
        args.push('-maxrate', maxBitrate, '-bufsize', (parseInt(maxBitrate) * 2) + 'M');
      }

      // Audio and optimization settings
      args.push(
        // Audio encoding - smart bitrate based on original
        '-c:a', 'aac',
        '-b:a', file.size > 20 * 1024 * 1024 ? '128k' : '192k',
        // Frame rate and keyframe optimization
        '-r', '30',
        '-g', '60', // Larger keyframe interval for better compression
        // Optimization flags
        '-movflags', '+faststart',
        '-avoid_negative_ts', 'make_zero',
        '-fflags', '+genpts',
        '-max_muxing_queue_size', '1024',
        '-y', // Overwrite output
        outputName
      );

      console.log('🔧 FFmpeg command:', ['ffmpeg', ...args].join(' '));

      // Execute FFmpeg command
      await this.ffmpeg.exec(args);

      // Read output file and convert to compatible buffer
      const outputData = await this.ffmpeg.readFile(outputName) as Uint8Array;
      const outputBlob = new Blob([outputData.slice().buffer], { type: 'video/mp4' });

      // Log compression results
      const compressionRatio = ((file.size - outputBlob.size) / file.size) * 100;
      console.log(`📊 Compression results:`);
      console.log(`   Original: ${this.formatFileSize(file.size)}`);
      console.log(`   Trimmed:  ${this.formatFileSize(outputBlob.size)}`);
      console.log(`   Compression: ${compressionRatio > 0 ? '+' : ''}${compressionRatio.toFixed(1)}%`);

      // Generate thumbnail and other metadata
      const base64 = await this.blobToBase64(outputBlob);
      const thumbnail = await this.generateThumbnail(outputBlob);

      const result: CompressedVideoData = {
        blob: outputBlob,
        base64,
        duration: Math.floor(duration),
        thumbnail,
        size: outputBlob.size
      };

      // Cleanup FFmpeg filesystem
      try {
        await this.ffmpeg.deleteFile(inputName);
        await this.ffmpeg.deleteFile(outputName);
      } catch (e) {
        console.warn('Failed to cleanup FFmpeg files:', e);
      }

      console.log('✅ FFmpeg intelligent trim completed successfully');
      return result;

    } catch (error) {
      console.error('❌ FFmpeg trim failed:', error);
      throw new Error(`FFmpeg processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get video duration from file
   */
  private async getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => resolve(60); // fallback
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get file extension from File object
   */
  private getFileExtension(file: File): string {
    const name = file.name.toLowerCase();
    if (name.endsWith('.mp4')) return 'mp4';
    if (name.endsWith('.webm')) return 'webm';
    if (name.endsWith('.mov')) return 'mov';
    if (name.endsWith('.avi')) return 'avi';
    return 'mp4'; // fallback
  }

  /**
   * Convert blob to base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Generate thumbnail from video blob
   */
  private async generateThumbnail(videoBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      video.onloadedmetadata = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        canvas.width = 300;
        canvas.height = 300 / aspectRatio;

        const seekTime = Math.min(1, video.duration * 0.1);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(video.src);
          resolve(thumbnail);
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        reject(new Error('Failed to load video for thumbnail'));
      };

      video.src = URL.createObjectURL(videoBlob);
      video.load();
    });
  }

  /**
   * Format file size for logging
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup FFmpeg instance
   */
  dispose(): void {
    this.ffmpeg = null;
    this.isLoaded = false;
    this.isLoading = false;
  }
}