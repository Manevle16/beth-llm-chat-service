# Image Storage Migration Requirements

## Introduction

This document outlines requirements for migrating the Beth LLM Chat Service from storing images as base64 data in the database to storing images as files on the local filesystem with database records containing file paths. This migration will improve database performance, reduce storage overhead, and maintain the same API functionality for the stream-message endpoint.

---

## Requirements

### Requirement 1: Database Schema Migration

**User Story:**  
As a **system administrator**, I want **images to be stored as files on the local filesystem** so that **database performance is improved and storage overhead is reduced**.

#### Acceptance Criteria

1. WHEN **the migration is executed** THEN the system SHALL **remove the base64_data column from the images table**
2. WHEN **a new image is uploaded** THEN the system SHALL **store the image file on the local filesystem and save only the file path in the database**
3. WHEN **an image is retrieved for vision processing** THEN the system SHALL **read the file from the filesystem and convert it to base64 for Ollama API**
4. IF **a file is missing from the filesystem** THEN the system SHALL **log an error and return a fallback response**
5. IF **the filesystem is not accessible** THEN the system SHALL **log the error and continue with text-only processing**
6. WHEN the system starts up THEN it SHALL **validate that the image storage directory exists and is writable**
7. IF the system is restarted THEN it SHALL **maintain all existing file paths and continue serving images from the filesystem**

---

### Requirement 2: File System Storage Implementation

**User Story:**  
As a **developer**, I want **images to be stored in a structured filesystem hierarchy** so that **file management is organized and efficient**.

#### Acceptance Criteria

1. WHEN **an image is uploaded** THEN the system SHALL **create a unique filename using the image ID and original extension**
2. WHEN **an image is stored** THEN the system SHALL **save it to the configured IMAGE_STORAGE_PATH directory**
3. WHEN **an image is served** THEN the system SHALL **read the file from the filesystem and serve it with proper MIME type headers**
4. IF **the storage directory doesn't exist** THEN the system SHALL **create it automatically with appropriate permissions**
5. IF **disk space is insufficient** THEN the system SHALL **reject the upload with a clear error message**
6. WHEN **an image is deleted** THEN the system SHALL **remove both the database record and the physical file**
7. IF **file deletion fails** THEN the system SHALL **log the error but continue with database cleanup**

---

### Requirement 3: Vision Model Integration Update

**User Story:**  
As a **user**, I want **vision processing to continue working seamlessly** so that **I can still upload images and get vision-enabled responses**.

#### Acceptance Criteria

1. WHEN **images are processed for vision** THEN the system SHALL **read files from the filesystem and convert them to base64 for Ollama API**
2. WHEN **multiple images are processed** THEN the system SHALL **handle each file conversion independently with proper error handling**
3. IF **a file cannot be read from the filesystem** THEN the system SHALL **skip that image and continue processing others**
4. IF **all image files are missing** THEN the system SHALL **fall back to text-only processing with a warning**
5. WHEN **vision processing completes** THEN the system SHALL **clean up any temporary base64 data from memory**
6. IF **file conversion to base64 fails** THEN the system SHALL **log the error and exclude the image from vision processing**

---

### Requirement 4: API Compatibility Maintenance

**User Story:**  
As a **frontend developer**, I want **the existing API endpoints to continue working unchanged** so that **no frontend modifications are required**.

#### Acceptance Criteria

1. WHEN **the /api/stream-message endpoint receives an image upload** THEN the system SHALL **process it using the new file-based storage**
2. WHEN **the /api/images/:imageId endpoint is called** THEN the system SHALL **serve the image from the filesystem with the same response format**
3. WHEN **image metadata is requested** THEN the system SHALL **return the same JSON structure as before**
4. IF **an image is not found** THEN the system SHALL **return the same 404 error response format**
5. WHEN **image URLs are generated** THEN the system SHALL **maintain the same URL structure for backward compatibility**


> 🔧 Tip: This migration should be implemented as a feature flag to allow gradual rollout and rollback capability.  
> 📌 Ensure all file operations use proper error handling and logging for debugging.  
> ✅ The migration should not affect the stream-message API functionality - only the underlying storage mechanism changes. 