# Image Storage Migration Design Document

## Overview

This feature implements filesystem-based image storage for the Beth LLM Chat Service, storing images as files on the local filesystem with database records containing file paths. This approach improves database performance, reduces storage overhead, and maintains full API compatibility for the stream-message endpoint.

---

## Architecture

The system follows a modular architecture with separation of concerns across services:

- **ImageUploadHandler**: Processes multipart uploads and coordinates storage operations
- **ImageStorageService**: Manages filesystem operations and file serving
- **ImageDatabaseService**: Handles database operations for image metadata
- **VisionModelService**: Converts files to base64 for Ollama vision API
- **ConfigurationService**: Loads runtime settings and validates storage paths

---

## Components and Interfaces

### ImageUploadHandler

```javascript
interface ImageUploadHandler {
  processUploadedFiles(files: File[], conversationId: string, messageId: string): Promise<ProcessedImages>;
  validateImageFile(imageData: ImageData): Promise<ValidationResult>;
  cleanupTempFiles(filePaths: string[]): Promise<void>;
}
```

- Processes multipart form data uploads
- Validates image files before storage
- Coordinates between storage and database services
- Cleans up temporary files after processing

---

### ImageStorageService

```javascript
interface ImageStorageService {
  storeImageFile(buffer: Buffer, imageId: string, extension: string): Promise<string>;
  readImageFile(filePath: string): Promise<Buffer>;
  serveImage(imageId: string): Promise<ImageResponse>;
  deleteImageFile(filePath: string): Promise<boolean>;
  validateFileExists(filePath: string): Promise<boolean>;
  getFilesystemStats(): Promise<StorageStats>;
}
```

- Manages filesystem operations for image storage
- Creates organized directory structure (year/month)
- Handles file serving with proper MIME types
- Provides storage statistics and cleanup operations

---

### ImageDatabaseService

```javascript
interface ImageDatabaseService {
  saveImageRecord(imageRecord: ImageRecord): Promise<ImageRecord>;
  getImageById(imageId: string): Promise<ImageRecord | null>;
  getImagesByMessageId(messageId: string): Promise<ImageRecord[]>;
  deleteImageRecord(imageId: string): Promise<boolean>;
  cleanupExpiredImages(): Promise<number>;
}
```

- Manages image metadata in database
- Handles CRUD operations for image records
- Maintains referential integrity with conversations and messages
- Provides cleanup for expired images

---

### VisionModelService

```javascript
interface VisionModelService {
  processImagesForVision(imageIds: string[]): Promise<VisionMessage[]>;
  convertFileToBase64(filePath: string): Promise<string>;
  sendVisionRequest(modelName: string, prompt: string, visionMessages: VisionMessage[]): Promise<OllamaResponse>;
  hasVisionCapability(modelName: string): Promise<boolean>;
}
```

- Converts filesystem images to base64 for Ollama API
- Handles vision model integration
- Manages temporary base64 data in memory
- Provides fallback for non-vision models

---



### ConfigurationService

```javascript
interface ConfigurationService {
  getStoragePath(): string;
  getMaxFileSize(): number;
  getRetentionDays(): number;
  isMigrationEnabled(): boolean;
  validateConfiguration(): Promise<ValidationResult>;
}
```

- Provides runtime configuration for storage settings
- Validates storage paths and permissions
- Manages feature flags for migration rollout

---

## Data Models

```javascript
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
  deleted_at: Date | null;
}

interface ProcessedImages {
  images: StoredImage[];
  validationResult: ValidationResult;
}

interface StoredImage {
  id: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  hash: string;
  record: ImageRecord;
}

interface VisionMessage {
  image_url: string;
  image_id: string;
  filename: string;
  mime_type: string;
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

## Error Handling

- **File System Errors**: Log detailed errors, attempt recovery, provide fallback responses
- **Database Errors**: Use transactions for consistency, retry with backoff for transient failures
- **Vision Processing Errors**: Skip failed images, continue with remaining images, log warnings

- **Configuration Errors**: Validate at startup, disable features gracefully if invalid

---

## Recovery Mechanisms

- **File System Recovery**: Validate storage directory on startup, recreate if missing
- **Database Consistency**: Use foreign key constraints, implement cleanup for orphaned records
- **Vision Processing Recovery**: Retry failed file reads, fallback to text-only processing

- **Storage Cleanup**: Automatic cleanup of expired files, orphaned file detection and removal

---

## Testing Strategy

### Unit Testing

- File system operations and error handling
- Database operations and transaction management
- Vision model integration and base64 conversion

- Configuration validation and error handling

### Integration Testing

- Complete image upload and serving workflow
- Vision processing with filesystem images

- Error scenarios and recovery mechanisms
- Performance testing with large files

### Manual Testing

- Image upload through web interface
- Vision model responses with uploaded images

- System restart and recovery scenarios

---

## Implementation Notes

- Use organized directory structure (year/month) for efficient file management
- Implement atomic file operations to prevent corruption
- Use streaming for large file operations to manage memory usage

- Use proper file permissions (644) for security
- Implement comprehensive logging for debugging and monitoring

---

## Environment Configuration

Environment variables:

- `IMAGE_STORAGE_PATH` - Base directory for image storage
- `IMAGE_MAX_SIZE_MB` - Maximum file size in megabytes
- `IMAGE_RETENTION_DAYS` - Days to retain images before cleanup

- `VISION_MODEL_DETECTION_ENABLED` - Enable vision capability detection

Validate all configuration at startup and fail gracefully if required settings are missing.

---

## Implementation Strategy

### Database Schema Setup
1. Create images table without base64_data column
2. Ensure proper indexes and constraints for file path storage
3. Set up foreign key relationships with conversations and messages

### File System Setup
1. Create organized directory structure for image storage
2. Set proper permissions and ownership for security
3. Implement storage path validation and creation

### Service Implementation
1. Update ImageUploadHandler to store files on filesystem
2. Enhance ImageStorageService for file operations
3. Modify VisionModelService to read files and convert to base64
4. Update ImageDatabaseService to handle file path storage

---

## Success Criteria

### Performance Metrics
- **Database Size**: 50%+ reduction in database storage
- **Query Performance**: 30%+ improvement in image-related queries
- **Memory Usage**: 40%+ reduction in memory pressure during image processing
- **Backup Time**: 60%+ reduction in backup/restore times

### Reliability Metrics
- **Error Rate**: <0.1% file system errors
- **Availability**: 99.9% uptime
- **Data Integrity**: 100% consistency between database and file system
- **Recovery Time**: <5 minutes for file system issues

### User Experience
- **API Compatibility**: 100% compatibility with existing endpoints
- **Response Time**: No degradation in image serving performance
- **Vision Processing**: Maintained accuracy and speed
- **Error Handling**: Graceful degradation for file system issues

---

## 🧠 LLM Prompting Tips

Use this design document in combination with the following workflow:

1. **Start with the Requirements Document**  
   Define specific requirements and acceptance criteria for filesystem storage.

2. **Follow with this Design Document**  
   Elaborate on technical architecture and implementation approach.

3. **Generate Implementation Plan**  
   Create detailed implementation steps and code specifications.

4. **Create Database Schema**  
   Develop database schema without base64 storage.

5. **Implement and Test**  
   Build the feature with comprehensive testing and validation.

---

## ✅ Prompting Suggestions

- "Based on this design document, generate an implementation plan for the filesystem storage service."
- "What database schema would be needed for this design?"
- "Can you write the ImageStorageService interface with error handling?"
- "Generate unit tests for the VisionModelService file conversion logic."

> 💡 Be specific about file system operations and error handling scenarios.
> 🧩 Customize the implementation strategy based on your deployment environment.
> 🧪 Always test file system operations and database consistency post-implementation. 