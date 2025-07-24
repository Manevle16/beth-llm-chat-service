# Image Storage Filesystem Implementation Plan

This plan outlines the steps to implement direct filesystem-based image storage for the Beth LLM Chat Service, based on the requirements and design documents. There is no migration or feature flag; the system will use filesystem storage from the start.

---

## 1. Database Schema

- [x] Remove `base64_data` column from the `images` table (if present)
- [x] Ensure `file_path` is present and indexed in the `images` table
- [x] Confirm all necessary foreign key constraints and indexes
- [x] Update schema documentation and SQL files

---

## 2. File System Setup

- [x] Define and document the `IMAGE_STORAGE_PATH` environment variable
- [x] Implement logic to create the storage directory if it does not exist
- [x] Organize files by year/month subdirectories for scalability
- [x] Set proper permissions (e.g., 644 for files, 755 for directories)
- [x] Add validation for available disk space before accepting uploads

---

## 3. Service Layer Changes

### ImageUploadHandler
- [x] Update to store uploaded images as files in the filesystem
- [x] Generate unique filenames using image ID and extension
- [x] Save only the file path in the database record
- [x] Remove any base64 encoding logic

### ImageStorageService
- [ ] Implement `storeImageFile(buffer, imageId, extension)` to save files
- [ ] Implement `readImageFile(filePath)` to retrieve files for serving or processing
- [ ] Implement `deleteImageFile(filePath)` for cleanup
- [ ] Implement `getFilesystemStats()` for monitoring
- [ ] Add error handling for missing/corrupt files and permission issues

### ImageDatabaseService
- [x] Update to remove all references to `base64_data`
- [x] Ensure CRUD operations use `file_path` for image location
- [ ] Add validation for file path integrity

### VisionModelService
- [x] Update to read image files from the filesystem and convert to base64 for Ollama
- [x] Remove all logic that reads base64 from the database
- [x] Add error handling for missing files during vision processing

---

## 4. API Endpoint Updates

- [ ] Ensure `/api/stream-message` uses the new storage logic for uploads
- [ ] Ensure `/api/images/:imageId` serves files from the filesystem
- [ ] Update any endpoints that return image metadata to use the new structure
- [ ] Maintain existing API response formats for compatibility

---

## 5. Error Handling & Recovery

- [ ] Log and handle file system errors (missing files, permission denied, disk full)
- [ ] Implement fallback for vision processing if files are missing
- [ ] Add cleanup logic for orphaned files and expired images
- [ ] Ensure robust validation and error messages for all file operations

---

## 6. Testing

### Unit Tests
- [ ] Test file storage and retrieval logic
- [ ] Test error handling for file system operations
- [ ] Test database CRUD operations for image records
- [ ] Test vision model file-to-base64 conversion

### Integration Tests
- [ ] Test end-to-end image upload, storage, and serving
- [ ] Test vision processing with uploaded images
- [ ] Test error scenarios (missing file, disk full, permission error)

### Manual Tests
- [ ] Upload images via frontend and verify storage
- [ ] Retrieve and display images in the chat UI
- [ ] Simulate file system errors and verify system behavior

---

## 7. Documentation

- [ ] Update README and API docs to reflect new storage approach
- [ ] Document environment variables and configuration
- [ ] Add developer notes on file structure and error handling

---

## 8. Deployment

- [ ] Ensure storage directory exists and is writable in all environments
- [ ] Validate environment configuration before deployment
- [ ] Monitor logs for file system errors after deployment

---

> All steps should be completed before enabling the service in production. No legacy base64 storage or migration logic is required. 