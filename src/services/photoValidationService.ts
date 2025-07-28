export interface PhotoValidationResult {
  isValid: boolean;
  errorType?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  contentType?: string;
}

export class PhotoValidationService {
  private static instance: PhotoValidationService;

  static getInstance(): PhotoValidationService {
    if (!PhotoValidationService.instance) {
      PhotoValidationService.instance = new PhotoValidationService();
    }
    return PhotoValidationService.instance;
  }

  // Validate a photo URL with comprehensive checks
  async validatePhoto(url: string, timeout = 5000): Promise<PhotoValidationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PhotoValidator/1.0)'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          isValid: false,
          errorType: `HTTP_${response.status}`
        };
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !this.isImageContentType(contentType)) {
        return {
          isValid: false,
          errorType: 'INVALID_CONTENT_TYPE'
        };
      }

      const contentLength = response.headers.get('content-length');
      const fileSize = contentLength ? parseInt(contentLength, 10) : undefined;

      // Check file size constraints
      if (fileSize) {
        if (fileSize > 50 * 1024 * 1024) { // 50MB limit
          return {
            isValid: false,
            errorType: 'FILE_TOO_LARGE'
          };
        }
        
        if (fileSize < 100) { // Minimum 100 bytes
          return {
            isValid: false,
            errorType: 'FILE_TOO_SMALL'
          };
        }
      }

      return {
        isValid: true,
        contentType,
        fileSize
      };

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            isValid: false,
            errorType: 'TIMEOUT'
          };
        }
        
        if (error.message.includes('network')) {
          return {
            isValid: false,
            errorType: 'NETWORK_ERROR'
          };
        }
      }

      return {
        isValid: false,
        errorType: 'UNKNOWN_ERROR'
      };
    }
  }

  // Validate multiple photos with concurrency control
  async validatePhotos(urls: string[], maxConcurrency = 3): Promise<Map<string, PhotoValidationResult>> {
    const results = new Map<string, PhotoValidationResult>();
    const semaphore = new Semaphore(maxConcurrency);

    const validationPromises = urls.map(async (url) => {
      await semaphore.acquire();
      try {
        const result = await this.validatePhoto(url);
        results.set(url, result);
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(validationPromises);
    return results;
  }

  // Check if content type is a valid image type
  private isImageContentType(contentType: string): boolean {
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff'
    ];
    
    return validTypes.some(type => contentType.toLowerCase().includes(type));
  }

  // Get quality score based on validation result
  getQualityScore(result: PhotoValidationResult): number {
    if (!result.isValid) return 0;

    let score = 50; // Base score for valid images

    // Content type scoring
    if (result.contentType) {
      const contentType = result.contentType.toLowerCase();
      if (contentType.includes('jpeg') || contentType.includes('jpg')) score += 10;
      else if (contentType.includes('png')) score += 8;
      else if (contentType.includes('webp')) score += 12;
    }

    // File size scoring
    if (result.fileSize) {
      if (result.fileSize > 500000) score += 15; // Large, likely high quality
      else if (result.fileSize > 100000) score += 10; // Medium quality
      else if (result.fileSize > 20000) score += 5; // Acceptable quality
    }

    return Math.min(100, Math.max(0, score));
  }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}