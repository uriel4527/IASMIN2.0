/**
 * Video compression and processing utilities
 * Handles video recording, compression, and thumbnail generation
 */

export interface CompressedVideoData {
  blob: Blob;
  base64: string;
  duration: number;
  thumbnail: string;
  size: number;
}

export interface TrimData {
  startTime: number;
  endTime: number;
}

export interface ProcessingOptions {
  method?: 'auto' | 'ffmpeg' | 'canvas';
  quality?: 'speed' | 'quality';
  useWebGL?: boolean;
}

export interface GalleryVideoData {
  file: File;
  duration: number;
  thumbnail: string;
  originalSize: number;
}

export interface VideoRecorderOptions {
  maxDuration?: number; // in seconds, default 120 (2 minutes)
  maxSize?: number; // in bytes, default 450MB
  videoBitsPerSecond?: number; // default 1Mbps
}

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private options: Required<VideoRecorderOptions>;
  private currentFacingMode: 'user' | 'environment' = 'environment'; // Start with back camera

  constructor(options: VideoRecorderOptions = {}) {
    this.options = {
      maxDuration: options.maxDuration || 120, // 2 minutes
      maxSize: options.maxSize || 450 * 1024 * 1024, // 450MB
      videoBitsPerSecond: options.videoBitsPerSecond || 1000000 // 1Mbps
    };
  }

  async startRecording(): Promise<void> {
    try {
      // Request camera and microphone access with back camera by default
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: this.currentFacingMode // Start with back camera
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Configure MediaRecorder with optimal settings
      const mimeType = this.getSupportedMimeType();
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: this.options.videoBitsPerSecond,
        audioBitsPerSecond: 128000 // 128kbps for audio
      });

      this.chunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      // Remove internal auto-stop to allow external control
      // The hook/controller should handle max duration
      
      this.mediaRecorder.start(1000); // Collect data every second

    } catch (error) {
      this.cleanup();
      throw new Error('Failed to start video recording: ' + (error as Error).message);
    }
  }

  async stopRecording(): Promise<CompressedVideoData> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording to stop'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const duration = Math.floor((Date.now() - this.startTime) / 1000);
          const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
          
          // Check size limit
          if (blob.size > this.options.maxSize) {
            throw new Error(`Vídeo muito grande (${formatFileSize(blob.size)}). Limite máximo: 450MB.`);
          }

          const base64 = await this.blobToBase64(blob);
          const thumbnail = await this.generateThumbnail(blob);

          const result: CompressedVideoData = {
            blob,
            base64,
            duration,
            thumbnail,
            size: blob.size
          };

          this.cleanup();
          resolve(result);

        } catch (error) {
          this.cleanup();
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async switchCamera(): Promise<void> {
    if (!this.stream) {
      throw new Error('No active stream to switch camera');
    }

    try {
      // Stop current stream
      this.stream.getTracks().forEach(track => track.stop());

      // Toggle facing mode
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';

      // Request new stream with the opposite camera
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: this.currentFacingMode
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Update MediaRecorder with new stream
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        // Stop current recording
        this.mediaRecorder.stop();
        
        // Create new MediaRecorder with new stream
        const mimeType = this.getSupportedMimeType();
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType,
          videoBitsPerSecond: this.options.videoBitsPerSecond,
          audioBitsPerSecond: 128000
        });

        // Restore event handlers
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.chunks.push(event.data);
          }
        };

        // Continue recording
        this.mediaRecorder.start(1000);
      }

    } catch (error) {
      throw new Error('Failed to switch camera: ' + (error as Error).message);
    }
  }

  getCurrentFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus', 
      'video/webm',
      'video/mp4;codecs=h264,aac',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // fallback
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async generateThumbnail(videoBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Thumbnail generation timed out'));
      }, 10000);

      video.onloadedmetadata = () => {
        // Set canvas size to maintain aspect ratio
        const aspectRatio = video.videoWidth / video.videoHeight;
        canvas.width = 300;
        canvas.height = 300 / aspectRatio;

        // Seek to 1 second or 10% of duration, whichever is smaller
        // Handle Infinity duration (common in WebM)
        let seekTime = 0;
        if (Number.isFinite(video.duration) && video.duration > 0) {
            seekTime = Math.min(1, video.duration * 0.1);
        } else {
            // Fallback for when duration is not available immediately
            seekTime = 0.5;
        }
        
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        clearTimeout(timeoutId);
        try {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert to base64
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          
          // Cleanup
          URL.revokeObjectURL(video.src);
          
          resolve(thumbnail);
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video for thumbnail generation'));
      };

      video.src = URL.createObjectURL(videoBlob);
      video.load(); // Explicitly call load
    });
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

// Utility functions
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function validateVideoFile(file: File): boolean {
  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi'];
  const maxSize = 450 * 1024 * 1024; // 450MB
  
  return validTypes.includes(file.type) && file.size <= maxSize;
}

export class VideoProcessor {
  private ffmpegProcessor: any = null; // Lazy loaded to avoid import issues

  constructor() {
    this.initializeFFmpeg();
  }

  /**
   * Initialize FFmpeg processor lazily
   */
  private async initializeFFmpeg() {
    try {
      const { FFmpegVideoProcessor } = await import('./ffmpegVideoProcessor');
      this.ffmpegProcessor = new FFmpegVideoProcessor();
      await this.ffmpegProcessor.initialize();
    } catch (error) {
      console.warn('FFmpeg not available, using canvas fallback:', error);
      this.ffmpegProcessor = null;
    }
  }

  async loadGalleryVideo(file: File): Promise<GalleryVideoData> {
    return new Promise((resolve, reject) => {
      if (!validateVideoFile(file)) {
        reject(new Error(`Arquivo de vídeo inválido ou muito grande (${formatFileSize(file.size)}). Limite máximo: 450MB.`));
        return;
      }

      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = async () => {
        try {
          const duration = video.duration;
          const thumbnail = await this.generateThumbnailFromVideo(video);
          
          const galleryVideoData: GalleryVideoData = {
            file,
            duration,
            thumbnail,
            originalSize: file.size
          };

          URL.revokeObjectURL(url);
          resolve(galleryVideoData);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Erro ao carregar o vídeo'));
      };

      video.src = url;
    });
  }

  /**
   * Smart video trimming with intelligent method selection
   */
  async trimVideo(file: File, trimData: TrimData, options: ProcessingOptions = {}): Promise<CompressedVideoData> {
    const { method = 'auto', quality = 'quality' } = options;
    
    // Analyze video to choose optimal processing method
    const videoInfo = await this.analyzeVideo(file);
    const optimalMethod = this.selectOptimalMethod(videoInfo, method);
    
    console.log(`🎯 Selected processing method: ${optimalMethod} (quality: ${quality})`);
    
    // Try FFmpeg first for re-encoding quality
    if ((optimalMethod === 'ffmpeg' || optimalMethod === 'auto') && this.ffmpegProcessor) {
      try {
        console.log('🎯 Using FFmpeg high-quality re-encoding...');
        return await this.ffmpegProcessor.trimVideo(file, trimData, quality);
      } catch (error) {
        console.warn('⚠️ FFmpeg failed, falling back to canvas:', error);
        if (method === 'ffmpeg') {
          throw error; // Don't fallback if user specifically requested FFmpeg
        }
      }
    }

    console.log('🎨 Using ultra-high quality canvas processing...');
    return this.trimVideoCanvas(file, trimData, quality);
  }

  /**
   * Analyze video properties to determine optimal processing method
   */
  private async analyzeVideo(file: File): Promise<{duration: number, size: number, codec: string}> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        const info = {
          duration: video.duration,
          size: file.size,
          codec: file.type
        };
        URL.revokeObjectURL(video.src);
        resolve(info);
      };
      video.onerror = () => {
        resolve({ duration: 0, size: file.size, codec: file.type });
      };
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Select optimal processing method based on video characteristics
   */
  private selectOptimalMethod(videoInfo: any, userPreference: string): string {
    if (userPreference !== 'auto') return userPreference;
    
    // Use FFmpeg for longer videos or larger files (better compression efficiency)
    if (videoInfo.duration > 60 || videoInfo.size > 20 * 1024 * 1024) {
      return 'ffmpeg';
    }
    
    // Use canvas for shorter videos (faster processing)
    return 'canvas';
  }

  /**
   * Ultra-enhanced canvas-based trimming with maximum quality settings
   */
  private async trimVideoCanvas(file: File, trimData: TrimData, quality: 'speed' | 'quality' = 'quality'): Promise<CompressedVideoData> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Não foi possível criar contexto do canvas'));
        return;
      }

      video.onloadedmetadata = async () => {
        try {
          // Configure video for maximum quality playback
          video.playbackRate = 1.0;
          video.preload = 'metadata';
          
          // Use NATIVE resolution - don't downscale!
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          console.log(`📺 Native resolution: ${video.videoWidth}x${video.videoHeight}`);

          // Enable maximum quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Set high-quality canvas context attributes
          const contextAttributes = {
            alpha: false,
            desynchronized: false,
            colorSpace: 'rec2020' as PredefinedColorSpace
          };
          
          try {
            // Apply high-quality context attributes if supported
            Object.assign(ctx, contextAttributes);
          } catch (e) {
            console.log('Some context attributes not supported');
          }

          // Create MediaRecorder to record the trimmed video with high quality settings
          const stream = canvas.captureStream(30) as MediaStream;
          
          // Add audio track if available
          const audioContext = new AudioContext();
          const source = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          
          // Combine video and audio streams
          const audioTrack = destination.stream.getAudioTracks()[0];
          if (audioTrack) {
            stream.addTrack(audioTrack);
          }

          const mimeType = this.getSupportedMimeType();
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            // Intelligent bitrate based on original file size and quality setting
            videoBitsPerSecond: this.calculateCanvasBitrate(file, quality),
            audioBitsPerSecond: file.size > 20 * 1024 * 1024 ? 128000 : 192000 // Scale audio bitrate
          });

          const chunks: Blob[] = [];
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = async () => {
            try {
              const trimmedBlob = new Blob(chunks, { type: mimeType });
              const base64 = await this.blobToBase64(trimmedBlob);
              const thumbnail = await this.generateThumbnailFromBlob(trimmedBlob);
              const duration = trimData.endTime - trimData.startTime;

              const result: CompressedVideoData = {
                blob: trimmedBlob,
                base64,
                duration: Math.floor(duration),
                thumbnail,
                size: trimmedBlob.size
              };

              // Cleanup
              stream.getTracks().forEach(track => track.stop());
              audioContext.close();

              resolve(result);
            } catch (error) {
              reject(error);
            }
          };

          // Start recording and play video with frame-perfect timing
          video.currentTime = trimData.startTime;
          mediaRecorder.start(quality === 'quality' ? 50 : 100); // Higher frequency for max quality

          let frameCount = 0;
          const targetFPS = 30;
          const frameInterval = 1000 / targetFPS;

          const renderFrame = () => {
            if (video.currentTime >= trimData.endTime) {
              video.pause();
              mediaRecorder.stop();
              return;
            }

            // Ultra-high quality frame rendering with frame-perfect synchronization
            ctx.save();
            
            // Maximum quality settings for each frame
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.globalCompositeOperation = 'source-over';
            
            // Clear with precise cleanup
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw at native resolution - zero scaling degradation
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            ctx.restore();
            
            frameCount++;
            
            // Use requestAnimationFrame for smooth rendering in quality mode
            if (quality === 'quality') {
              requestAnimationFrame(renderFrame);
            }
          };

          video.ontimeupdate = () => {
            if (quality === 'speed') {
              renderFrame(); // Use time update for speed mode
            }
          };

          // Start frame-perfect rendering for quality mode
          if (quality === 'quality') {
            requestAnimationFrame(renderFrame);
          }

          video.play();

        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        reject(new Error('Erro ao carregar o vídeo para corte'));
      };

      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate optimal canvas bitrate based on original file characteristics
   */
  private calculateCanvasBitrate(file: File, quality: 'speed' | 'quality'): number {
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (quality === 'speed') {
      // Speed mode - reasonable bitrates
      if (fileSizeMB < 10) return 4000000;   // 4 Mbps
      if (fileSizeMB < 30) return 6000000;   // 6 Mbps  
      return 8000000;                        // 8 Mbps max
    } else {
      // Quality mode - higher bitrates but capped to avoid huge files
      if (fileSizeMB < 5) return 8000000;    // 8 Mbps for small files
      if (fileSizeMB < 15) return 10000000;  // 10 Mbps for medium files
      if (fileSizeMB < 30) return 12000000;  // 12 Mbps for larger files
      return 15000000;                       // 15 Mbps maximum
    }
  }

  private getSupportedMimeType(): string {
    // Prioritize high-quality codecs for trimmed videos
    const types = [
      'video/webm;codecs=vp9,opus',    // Best quality codec
      'video/webm;codecs=vp8,opus',    // Good quality fallback
      'video/mp4;codecs=h264,aac',     // Wide compatibility
      'video/webm',                    // Basic webm
      'video/mp4'                      // Basic mp4
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Using codec for trimming:', type);
        return type;
      }
    }

    console.warn('Using fallback codec for trimming');
    return 'video/webm'; // fallback
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async generateThumbnailFromVideo(video: HTMLVideoElement): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Não foi possível criar contexto do canvas'));
        return;
      }

      // Set canvas size maintaining aspect ratio
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 300;
      canvas.height = 300 / aspectRatio;

      // Seek to 1 second or 10% of duration
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;

      video.onseeked = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          resolve(thumbnail);
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  private async generateThumbnailFromBlob(videoBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Não foi possível criar contexto do canvas'));
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
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(video.src);
          resolve(thumbnail);
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        reject(new Error('Erro ao gerar thumbnail do vídeo'));
      };

      video.src = URL.createObjectURL(videoBlob);
      video.load();
    });
  }
}