# Image Upload Feature Implementation Plan

Use this template to outline the implementation steps for adding image upload support to the stream message API. Each task should be aligned with specific requirements, tested, and documented for integration.

---

- [x] **1. Extend data models and types**
  - Add `ImageData`, `StoredImage`, `ImageRecord`, `ImageDisplayData` interfaces to `types/imageUpload.js`
  - Define `ValidationResult`, `StorageStats`, `VisionMessage` types
  - Create `IMAGE_UPLOAD_TYPES` enum for supported formats
  - Add image-related constants and validation rules
  - _Linked Requirements: REQ-1, REQ-3_

- [x] **2. Implement core image services**
  - Create `ImageValidationService` for file type/size validation and security scanning
  - Create `ImageStorageService` for file system operations and serving
  - Create `ImageDatabaseService` for metadata management and relationships
  - Add utility methods for image processing and URL generation
  - Write unit tests for all services
  - _Linked Requirements: REQ-1, REQ-3, REQ-5_

- [x] **3. Extend database schema and persistence layer**
  - Add `images` table with proper foreign key constraints and indexes
  - Add `has_images` column to existing `messages` table
  - Implement database migration scripts for schema changes
  - Add image integrity validation and cleanup procedures
  - Test persistence edge cases and data consistency
  - _Linked Requirements: REQ-3_

- [x] **4. Implement vision model integration**
  - Create `VisionModelService` for Ollama vision API integration
  - Add vision capability detection using Ollama API
  - Implement base64 conversion for local images to Ollama format
  - Add fallback handling for non-vision models and processing failures
  - Write unit tests for vision processing and error scenarios
  - _Linked Requirements: REQ-2_

- [x] **5. Add multipart request handling**
  - Create `ImageUploadHandler` for processing multipart form data
  - Extend `/api/stream-message` endpoint to handle both JSON and multipart requests
  - Maintain backward compatibility with existing text-only requests
  - Add request validation and error handling for multipart data
  - Integrate with existing stream session management
  - _Linked Requirements: REQ-4_

- [x] **6. Add image serving endpoints**
  - Create `GET /api/images/{imageId}` endpoint for image serving
  - Add proper MIME type handling and cache headers
  - Implement access control and permission validation
  - Add image serving middleware to Express app
  - Extend CORS configuration for image serving
  - _Linked Requirements: REQ-1, REQ-4_

- [x] **7. Integrate with existing streaming infrastructure**
  - Modify `ollamaService.js` to support vision requests with image data
  - Extend stream session tracking to include image processing
  - Maintain existing SSE event format for vision responses
  - Preserve stream termination capabilities for image requests
  - Ensure graceful error handling and partial response preservation
  - _Linked Requirements: REQ-2, REQ-4_

- [x] **8. Add configuration and environment setup**
  - Create `ImageConfigurationService` for runtime settings
  - Add image-related environment variables to `.env.example`
  - Implement configuration validation at startup
  - Add feature flags for enabling/disabling image upload
  - Create storage directory initialization and cleanup
  - _Linked Requirements: REQ-5_

- [x] **9. Add error handling and observability**
  - Extend existing error handling patterns for image processing
  - Implement retry logic for transient image processing failures
  - Add comprehensive logging for image operations
  - Track metrics for image upload performance and storage usage
  - Test error recovery scenarios and graceful degradation
  - _Linked Requirements: REQ-5_

- [x] **10. Write integration tests**
  - Test full image upload to vision processing pipeline
  - Verify multipart request handling and backward compatibility
  - Test database consistency and cleanup operations
  - Simulate error scenarios and fallback behavior
  - Verify image serving and display functionality
  - _Linked Requirements: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5_

- [x] **11. Add performance optimization and cleanup**
  - Implement automatic cleanup of expired images
  - Add memory management for large image processing
  - Optimize concurrent image upload handling
  - Profile and optimize storage operations
  - Validate system stability under high load
  - _Linked Requirements: REQ-5_

- [x] **12. Final integration and documentation**
  - Update API documentation for new endpoints
  - Add image upload examples to Postman collection
  - Update GraphQL schema if needed for image metadata
  - Create deployment and migration guides
  - Validate complete feature integration
  - _Linked Requirements: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5_

---

## Implementation Dependencies

### Required Dependencies
- `multer` for multipart form data processing
- `crypto` for image hashing and security
- `fs/promises` for file system operations
- `path` for file path handling

### Database Changes
- New `images` table with foreign key relationships
- Modified `messages` table with `has_images` flag
- Indexes for performance optimization

### Environment Variables
```bash
IMAGE_UPLOAD_ENABLED=true
IMAGE_STORAGE_PATH=./uploads/images
IMAGE_MAX_SIZE_MB=10
IMAGE_RETENTION_DAYS=30
IMAGE_ALLOWED_TYPES=image/png,image/jpeg,image/webp
VISION_MODEL_DETECTION_ENABLED=true
IMAGE_SERVE_ENDPOINT=/api/images
```

### File Structure
```
services/
├── imageValidationService.js
├── imageStorageService.js
├── imageDatabaseService.js
├── visionModelService.js
└── imageUploadHandler.js

types/
└── imageUpload.js

routes/
└── images.js (new)

uploads/
└── images/ (new directory)
```

---

> ✅ Tip: Implement services following existing patterns with initialize() methods and singleton exports.
>  
> 🎯 Goal: Maintain backward compatibility while adding comprehensive image upload and vision processing capabilities. 