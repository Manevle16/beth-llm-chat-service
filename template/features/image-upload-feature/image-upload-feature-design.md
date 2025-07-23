# Image Upload Feature Design Document

## Overview

This feature implements image upload and vision processing capabilities for the Beth LLM Chat Service. It enables users to upload images to the stream message API, allowing vision-capable models to analyze visual content and provide contextual responses. The system integrates with existing streaming infrastructure while adding secure image handling, storage management, and vision model integration.

---

## Architecture

The system follows the existing modular architecture with separation of concerns across services:

- **ImageUploadHandler**: Processes multipart form data and validates image uploads
- **ImageStorageService**: Manages secure image storage and file system operations
- **VisionModelService**: Handles vision-capable model detection and image processing
- **ImageDatabaseService**: Manages image metadata and conversation relationships
- **ImageValidationService**: Validates file types, sizes, and security
- **ConfigurationService**: Loads runtime settings for image processing

---

## Components and Interfaces

### ImageUploadHandler

```javascript
interface ImageUploadHandler {
  processMultipartRequest(req: Request): Promise<ProcessedRequest>;
  validateImageFile(file: Express.Multer.File): Promise<ValidationResult>;
  extractImageData(files: Express.Multer.File[]): Promise<ImageData[]>;
}
```

- Processes multipart form data from stream message endpoint
- Extracts and validates image files alongside text messages
- Maintains backward compatibility with text-only requests
- Delegates to validation and storage services

---

### ImageStorageService

```javascript
interface ImageStorageService {
  storeImage(imageData: ImageData, conversationId: string): Promise<StoredImage>;
  retrieveImage(imageId: string): Promise<Buffer>;
  serveImage(imageId: string): Promise<{ buffer: Buffer; mimeType: string }>;
  deleteImage(imageId: string): Promise<boolean>;
  cleanupExpiredImages(): Promise<number>;
  getStorageStats(): Promise<StorageStats>;
  generateImageUrl(imageId: string): string;
}
```

- Manages secure file system storage with unique identifiers
- Provides image serving capabilities for web display
- Implements automatic cleanup of expired images
- Provides storage statistics and monitoring
- Ensures atomic operations for file management

---

### VisionModelService

```javascript
interface VisionModelService {
  isVisionCapable(model: string): Promise<boolean>;
  processVisionRequest(model: string, message: string, images: ImageData[]): Promise<AsyncGenerator<string>>;
  formatVisionMessage(message: string, images: ImageData[]): Promise<VisionMessage>;
  handleVisionError(error: Error, fallbackMessage: string): Promise<string>;
  convertImageForOllama(imageData: ImageData): Promise<string>;
}
```

- Detects vision-capable models using Ollama API
- Formats requests according to Ollama's vision API specifications
- Converts local images to base64 data URLs for Ollama
- Integrates with existing streaming infrastructure
- Provides fallback behavior for non-vision models

---

### ImageDatabaseService

```javascript
interface ImageDatabaseService {
  saveImageRecord(imageRecord: ImageRecord): Promise<ImageRecord>;
  linkImageToMessage(imageId: string, messageId: string, conversationId: string): Promise<void>;
  getImagesForConversation(conversationId: string): Promise<ImageRecord[]>;
  getImagesForMessage(messageId: string): Promise<ImageRecord[]>;
  deleteImagesForConversation(conversationId: string): Promise<number>;
  validateImageIntegrity(): Promise<IntegrityReport>;
  getImageDisplayData(imageId: string): Promise<ImageDisplayData>;
}
```

- Manages image metadata in PostgreSQL database
- Links images to conversations and messages
- Provides image display data with serving URLs
- Ensures data consistency with foreign key constraints
- Provides integrity validation and cleanup

---

### ImageValidationService

```javascript
interface ImageValidationService {
  validateFileType(file: Express.Multer.File): Promise<ValidationResult>;
  validateFileSize(file: Express.Multer.File): Promise<ValidationResult>;
  scanForMaliciousContent(buffer: Buffer): Promise<SecurityResult>;
  generateImageHash(buffer: Buffer): Promise<string>;
}
```

- Validates supported image formats (PNG, JPEG, WebP)
- Enforces file size limits (max 10MB)
- Implements security scanning for malicious content
- Generates content hashes for integrity checking

---

### ConfigurationService

```javascript
interface ConfigurationService {
  getImageSettings(): ImageSettings;
  getStorageSettings(): StorageSettings;
  getSecuritySettings(): SecuritySettings;
  isFeatureEnabled(): boolean;
}
```

- Provides runtime configuration for image processing
- Validates required parameters at startup
- Supports environment-based configuration

---

## Data Models

```javascript
interface ProcessedRequest {
  message: string;
  images: ImageData[];
  model: string;
  conversationId: string;
  password?: string;
}

interface ImageData {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
}

interface StoredImage {
  id: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  hash: string;
  createdAt: Date;
}

interface ImageRecord {
  id: string;
  conversation_id: string;
  message_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  content_hash: string;
  created_at: Date;
  expires_at: Date;
}

interface VisionMessage {
  role: string;
  content: Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

interface ImageDisplayData {
  id: string;
  filename: string;
  displayUrl: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface StorageStats {
  totalImages: number;
  totalSize: number;
  oldestImage: Date;
  storagePath: string;
  availableSpace: number;
}
```

---

## Database Schema Extensions

```sql
-- Images table for storing image metadata
CREATE TABLE images (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for image management
CREATE INDEX idx_images_conversation_id ON images(conversation_id);
CREATE INDEX idx_images_message_id ON images(message_id);
CREATE INDEX idx_images_created_at ON images(created_at);
CREATE INDEX idx_images_expires_at ON images(expires_at);
CREATE INDEX idx_images_content_hash ON images(content_hash);

-- Add image support flag to messages table
ALTER TABLE messages ADD COLUMN has_images BOOLEAN DEFAULT FALSE;
CREATE INDEX idx_messages_has_images ON messages(has_images);
```

---

## Error Handling

- **File Upload Errors**: Validate file type, size, and security before processing
- **Storage Failures**: Implement retry logic with exponential backoff for file operations
- **Vision Model Errors**: Provide fallback to text-only processing with clear error messages
- **Database Errors**: Maintain data consistency with transaction rollbacks
- **Memory Issues**: Implement safeguards to prevent system overload during image processing

---

## Recovery Mechanisms

- **File System Recovery**: Validate image file integrity against database records on startup
- **Database Consistency**: Use foreign key constraints and cascading deletes for data integrity
- **Storage Cleanup**: Automatic cleanup of expired images with configurable retention policies
- **Error Recovery**: Graceful degradation when vision processing fails

---

## Image Serving Architecture

### Local Storage and Serving
- **File System Storage**: Images stored in local file system with unique identifiers
- **Static File Serving**: Express middleware serves images via HTTP endpoints
- **URL Generation**: Generate serving URLs like `/api/images/{imageId}`
- **MIME Type Handling**: Proper content-type headers for browser display
- **Access Control**: Validate image access permissions before serving

### Ollama Vision API Integration
- **Base64 Conversion**: Convert local images to base64 data URLs for Ollama
- **Data URL Format**: `data:image/png;base64,{base64Data}` for vision requests
- **Memory Management**: Efficient buffer handling for large images
- **Fallback Handling**: Text-only processing when vision fails

### Database Integration
- **Metadata Storage**: Store image metadata in PostgreSQL database
- **URL References**: Store serving URLs for frontend display
- **Relationship Tracking**: Link images to conversations and messages
- **Cleanup Coordination**: Database and file system cleanup synchronization

## Security Considerations

- **File Type Validation**: Strict validation of supported image formats
- **Content Scanning**: Basic security scanning for malicious content
- **Access Controls**: Secure file permissions and path validation
- **Storage Isolation**: Separate storage directory with proper access controls
- **Hash Verification**: Content hashing for integrity verification
- **URL Security**: Validate image access permissions in serving endpoints

---

## Performance Considerations

- **Streaming Integration**: Maintain existing SSE streaming performance with image processing
- **Memory Management**: Efficient buffer handling and cleanup for large images
- **Concurrent Processing**: Handle multiple image uploads without performance degradation
- **Storage Optimization**: Implement automatic cleanup to prevent storage bloat
- **Caching**: Optional caching for frequently accessed images

---

## Testing Strategy

### Unit Testing

- Image validation logic and security scanning
- Storage operations and file management
- Vision model integration and error handling
- Database operations and data consistency

### Integration Testing

- Full image upload to vision processing pipeline
- Multipart request handling and backward compatibility
- Database consistency and cleanup operations
- Error scenarios and fallback behavior

### Performance Testing

- Concurrent image upload handling
- Memory usage during image processing
- Storage cleanup efficiency
- Streaming performance with images

---

## Implementation Notes

- Use `multer` middleware for multipart form data processing
- Implement configurable storage paths and retention policies
- Use Ollama's vision API format for image requests (base64 data URLs)
- Maintain existing streaming session management for image requests
- Implement proper cleanup of temporary files and buffers
- Use environment variables for all configuration settings
- Add static file serving middleware for image display
- Convert local images to base64 for Ollama vision API
- Provide REST endpoints for image serving with proper MIME types

---

## Environment Configuration

Environment variables:

```bash
# Image Upload Configuration
IMAGE_UPLOAD_ENABLED=true
IMAGE_STORAGE_PATH=./uploads/images
IMAGE_MAX_SIZE_MB=10
IMAGE_RETENTION_DAYS=30
IMAGE_ALLOWED_TYPES=image/png,image/jpeg,image/webp

# Vision Model Configuration
VISION_MODEL_DETECTION_ENABLED=true
VISION_FALLBACK_ENABLED=true
VISION_PROCESSING_TIMEOUT_MS=30000

# Security Configuration
IMAGE_SECURITY_SCANNING_ENABLED=true
IMAGE_HASH_VERIFICATION_ENABLED=true

# Performance Configuration
IMAGE_CONCURRENT_UPLOADS=5
IMAGE_CLEANUP_INTERVAL_MS=3600000

# Image Serving Configuration
IMAGE_SERVE_ENDPOINT=/api/images
IMAGE_SERVE_CACHE_CONTROL=max-age=86400
IMAGE_SERVE_MAX_AGE=86400
```

Validate all configuration at startup and fail gracefully if required settings are missing.

---

## Integration with Existing Services

### Stream Session Management
- Extend existing stream session tracking to include image processing
- Maintain session termination capabilities for vision requests
- Preserve partial responses when image processing fails

### Model Rotation Service
- Integrate with existing model rotation for vision-capable models
- Maintain rotation priorities and queue management
- Support vision model detection in rotation logic

### Error Handling Service
- Extend existing error handling patterns for image processing
- Maintain consistent logging and metrics collection
- Implement retry logic for transient image processing failures

### Database Integration
- Follow existing database connection patterns
- Maintain transaction consistency with existing operations
- Extend existing cleanup procedures for image data

### Express Server Integration
- Add static file serving middleware for image display
- Extend existing CORS configuration for image serving
- Maintain existing request logging and error handling
- Add image serving routes with proper MIME type handling

---

## 🧠 LLM Prompting Tips

Use this design document in combination with the following workflow:

1. **Start with the Requirements Document**  
   Reference the generated requirements for acceptance criteria validation.

2. **Follow Implementation Patterns**  
   Use existing service patterns and error handling approaches.

3. **Generate Service Implementations**  
   Create individual service files following established patterns.

4. **Integrate with Existing Infrastructure**  
   Extend current endpoints and database schema incrementally.

5. **Test Integration Points**  
   Verify compatibility with existing streaming and session management.

---

## ✅ Implementation Checklist

- [ ] Create ImageUploadHandler service following existing patterns
- [ ] Implement ImageStorageService with file system management
- [ ] Develop VisionModelService for Ollama vision API integration
- [ ] Extend database schema with images table and indexes
- [ ] Update stream message endpoint for multipart support
- [ ] Add image validation and security scanning
- [ ] Implement cleanup and maintenance procedures
- [ ] Create comprehensive test suite
- [ ] Update configuration and environment variables
- [ ] Document API changes and integration points

> 💡 Follow existing service initialization patterns and error handling approaches.
> 🧩 Maintain backward compatibility with text-only requests.
> 🧪 Ensure comprehensive testing of vision model integration and error scenarios. 