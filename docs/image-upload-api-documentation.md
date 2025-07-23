# Image Upload API Documentation

This document provides comprehensive documentation for the Image Upload feature in the Beth LLM Chat Service.

## Overview

The Image Upload feature enables users to upload images and process them with vision-capable language models. The system supports:

- Multipart form data uploads
- Image validation and security scanning
- Automatic storage management
- Vision model integration
- Comprehensive error handling and observability

## Configuration

### Environment Variables

```bash
# Enable image upload feature
IMAGE_UPLOAD_ENABLED=true

# Storage configuration
IMAGE_STORAGE_PATH=./uploads/images
IMAGE_MAX_SIZE_MB=10
IMAGE_RETENTION_DAYS=30

# Allowed file types
IMAGE_ALLOWED_TYPES=image/png,image/jpeg,image/webp

# Vision model configuration
VISION_MODEL_DETECTION_ENABLED=true
IMAGE_SERVE_ENDPOINT=/api/images
```

### Database Schema

The feature requires the following database tables:

```sql
-- Images table
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

-- Updated messages table
ALTER TABLE messages ADD COLUMN has_images BOOLEAN DEFAULT FALSE;
```

## API Endpoints

### 1. Stream Message with Image Upload

**Endpoint:** `POST /api/stream-message`

**Description:** Send a message with optional image uploads. Supports both JSON and multipart form data.

**Content Types:**
- `application/json` - Text-only messages (backward compatibility)
- `multipart/form-data` - Messages with image uploads

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Ollama model name (e.g., "llava:7b" for vision) |
| `message` | string | Yes | Text message |
| `conversationId` | string | Yes | Conversation identifier |
| `images` | file[] | No | Image files to upload |

**Example - JSON Request:**
```bash
curl -X POST http://localhost:4000/api/stream-message \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "message": "Hello, this is a test message",
    "conversationId": "conversation-123"
  }'
```

**Example - Multipart Request:**
```bash
curl -X POST http://localhost:4000/api/stream-message \
  -F "model=llava:7b" \
  -F "message=What do you see in this image?" \
  -F "conversationId=conversation-123" \
  -F "images=@/path/to/image.jpg"
```

**Response:** Server-Sent Events (SSE) stream

### 2. Get Image by ID

**Endpoint:** `GET /api/images/{imageId}`

**Description:** Retrieve an image by its ID with access control.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `conversationId` | string | Yes | Conversation ID for access control |

**Example:**
```bash
curl -X GET "http://localhost:4000/api/images/image-123?conversationId=conversation-123"
```

**Response:** Image file with appropriate MIME type and cache headers

### 3. Get Image Metrics

**Endpoint:** `GET /api/images/metrics`

**Description:** Get comprehensive image processing metrics and statistics.

**Example:**
```bash
curl -X GET http://localhost:4000/api/images/metrics
```

**Response:**
```json
{
  "imageUpload": {
    "uploadConfig": {
      "maxFileSize": 10485760,
      "maxFiles": 5,
      "allowedTypes": ["image/png", "image/jpeg", "image/webp"],
      "storagePath": "./uploads/images"
    },
    "errorHandling": {
      "uploads": { "total": 0, "errors": 0, "success": 0 },
      "processing": { "total": 0, "errors": 0, "success": 0 },
      "vision": { "total": 0, "errors": 0, "success": 0 },
      "errorRate": 0
    },
    "isInitialized": true,
    "service": "ImageUploadHandler"
  },
  "errorHandling": { /* error handling metrics */ },
  "database": {
    "totalRecords": 0,
    "totalSize": 0,
    "lastCreated": null
  },
  "timestamp": "2025-07-23T20:51:15.529Z"
}
```

### 4. Get Recent Errors

**Endpoint:** `GET /api/images/errors`

**Description:** Get recent image processing errors for debugging.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Number of errors to return (default: 10) |

**Example:**
```bash
curl -X GET "http://localhost:4000/api/images/errors?limit=5"
```

**Response:**
```json
{
  "errors": [
    {
      "level": "error",
      "message": "Image upload error: file size exceeds limit",
      "timestamp": "2025-07-23T20:51:15.529Z",
      "context": { /* error context */ }
    }
  ],
  "total": 1,
  "timestamp": "2025-07-23T20:51:21.261Z"
}
```

### 5. Cleanup Management

#### Get Cleanup Stats
**Endpoint:** `GET /api/images/cleanup/stats`

**Description:** Get image cleanup service statistics.

**Example:**
```bash
curl -X GET http://localhost:4000/api/images/cleanup/stats
```

**Response:**
```json
{
  "totalCleanups": 1,
  "totalImagesRemoved": 0,
  "totalStorageFreed": 0,
  "lastCleanupDuration": 6,
  "lastCleanupTime": "2025-07-23T20:55:43.328Z",
  "nextCleanupTime": "2025-07-24T20:55:43.328Z",
  "cleanupIntervalMs": 86400000,
  "isInitialized": true
}
```

#### Trigger Cleanup
**Endpoint:** `POST /api/images/cleanup/trigger`

**Description:** Manually trigger the image cleanup process.

**Example:**
```bash
curl -X POST http://localhost:4000/api/images/cleanup/trigger
```

**Response:**
```json
{
  "message": "Cleanup process triggered successfully",
  "timestamp": "2025-07-23T20:55:43.328Z"
}
```

### 6. Storage Management

#### Get Storage Stats
**Endpoint:** `GET /api/images/storage/stats`

**Description:** Get storage statistics and usage information.

**Example:**
```bash
curl -X GET http://localhost:4000/api/images/storage/stats
```

**Response:**
```json
{
  "storagePath": "./uploads/images",
  "totalFiles": 0,
  "totalSize": 0,
  "averageFileSize": 0,
  "databaseRecords": 0,
  "databaseSize": 0,
  "lastUpdated": "2025-07-23T20:54:06.436Z"
}
```

#### Optimize Storage
**Endpoint:** `POST /api/images/storage/optimize`

**Description:** Optimize storage by removing orphaned files.

**Example:**
```bash
curl -X POST http://localhost:4000/api/images/storage/optimize
```

**Response:**
```json
{
  "message": "Storage optimization completed",
  "result": {
    "orphanedFiles": 0,
    "freedStorage": 0,
    "timestamp": "2025-07-23T20:55:54.260Z"
  },
  "timestamp": "2025-07-23T20:55:54.260Z"
}
```

## Error Handling

### Error Types

The system uses structured error types for different failure scenarios:

```javascript
const IMAGE_ERRORS = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  VISION_NOT_SUPPORTED: 'VISION_NOT_SUPPORTED'
};
```

### Error Response Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_TYPE",
  "details": {
    "imageId": "image-123",
    "filename": "test.jpg",
    "operation": "upload"
  }
}
```

### Retry Logic

The system implements automatic retry logic for transient failures:

- **Upload Operations:** 3 retries with exponential backoff
- **Database Operations:** 3 retries with exponential backoff
- **Vision Processing:** 2 retries with exponential backoff
- **Circuit Breaker:** Prevents cascading failures

## Security Features

### File Validation

- **File Type Validation:** Only allows specified MIME types
- **File Size Limits:** Configurable maximum file size
- **Content Hash Verification:** SHA-256 hash validation
- **Access Control:** Conversation-based access control

### Storage Security

- **Secure File Names:** UUID-based file naming
- **Path Traversal Protection:** Validates file paths
- **Automatic Cleanup:** Expired file removal
- **Orphaned File Detection:** Removes files without database records

## Performance Optimization

### Automatic Cleanup

- **Scheduled Cleanup:** Runs every 24 hours
- **Expired File Removal:** Removes files past retention period
- **Storage Optimization:** Removes orphaned files
- **Database Cleanup:** Marks expired records as deleted

### Memory Management

- **Stream Processing:** Processes large files in chunks
- **Buffer Management:** Efficient memory usage for uploads
- **Concurrent Processing:** Handles multiple uploads simultaneously

## Monitoring and Observability

### Metrics Collection

- **Upload Metrics:** Success/failure rates, file sizes
- **Processing Metrics:** Vision model performance
- **Storage Metrics:** Usage statistics, cleanup effectiveness
- **Error Metrics:** Error rates, failure patterns

### Logging

- **Structured Logging:** JSON-formatted logs with context
- **Error Tracking:** Detailed error information with stack traces
- **Performance Logging:** Operation timing and resource usage
- **Audit Logging:** File access and modification tracking

## Integration Examples

### JavaScript/Node.js

```javascript
// Upload image with message
const formData = new FormData();
formData.append('model', 'llava:7b');
formData.append('message', 'What do you see in this image?');
formData.append('conversationId', 'conversation-123');
formData.append('images', imageFile);

const response = await fetch('/api/stream-message', {
  method: 'POST',
  body: formData
});

// Handle SSE response
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = new TextDecoder().decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log('Received:', data);
    }
  }
}
```

### Python

```python
import requests

# Upload image with message
files = {'images': open('image.jpg', 'rb')}
data = {
    'model': 'llava:7b',
    'message': 'What do you see in this image?',
    'conversationId': 'conversation-123'
}

response = requests.post(
    'http://localhost:4000/api/stream-message',
    files=files,
    data=data,
    stream=True
)

# Handle SSE response
for line in response.iter_lines():
    if line:
        line = line.decode('utf-8')
        if line.startswith('data: '):
            data = json.loads(line[6:])
            print('Received:', data)
```

### cURL Examples

```bash
# Upload single image
curl -X POST http://localhost:4000/api/stream-message \
  -F "model=llava:7b" \
  -F "message=Describe this image" \
  -F "conversationId=conversation-123" \
  -F "images=@image.jpg"

# Upload multiple images
curl -X POST http://localhost:4000/api/stream-message \
  -F "model=llava:7b" \
  -F "message=Compare these images" \
  -F "conversationId=conversation-123" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"

# Get image metrics
curl -X GET http://localhost:4000/api/images/metrics

# Trigger cleanup
curl -X POST http://localhost:4000/api/images/cleanup/trigger
```

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size limits
   - Verify file type is allowed
   - Ensure storage directory is writable

2. **Vision Model Not Working**
   - Verify model supports vision (e.g., "llava:7b")
   - Check Ollama service is running
   - Review vision model logs

3. **Storage Issues**
   - Check disk space
   - Verify storage path permissions
   - Run storage optimization

4. **Database Errors**
   - Verify database connection
   - Check table schema
   - Review database logs

### Debug Endpoints

- `GET /api/images/metrics` - System health and performance
- `GET /api/images/errors` - Recent error logs
- `GET /api/images/cleanup/stats` - Cleanup service status
- `GET /api/images/storage/stats` - Storage usage information

## Deployment Considerations

### Production Setup

1. **Storage Configuration**
   - Use dedicated storage volume
   - Configure appropriate file permissions
   - Set up backup procedures

2. **Database Configuration**
   - Optimize PostgreSQL settings for image metadata
   - Set up connection pooling
   - Configure appropriate indexes

3. **Security Configuration**
   - Use HTTPS in production
   - Configure CORS appropriately
   - Set up rate limiting

4. **Monitoring Setup**
   - Configure log aggregation
   - Set up metrics collection
   - Configure alerting for errors

### Performance Tuning

1. **File Upload Limits**
   - Adjust `IMAGE_MAX_SIZE_MB` based on requirements
   - Configure `IMAGE_MAX_FILES` for concurrent uploads
   - Set appropriate timeout values

2. **Cleanup Configuration**
   - Adjust `IMAGE_RETENTION_DAYS` based on requirements
   - Configure cleanup frequency
   - Monitor cleanup performance

3. **Database Optimization**
   - Regular VACUUM operations
   - Monitor query performance
   - Optimize indexes as needed

## Support and Maintenance

### Regular Maintenance

1. **Storage Cleanup**
   - Monitor storage usage
   - Review cleanup logs
   - Adjust retention policies

2. **Performance Monitoring**
   - Track upload success rates
   - Monitor processing times
   - Review error patterns

3. **Security Updates**
   - Keep dependencies updated
   - Review security configurations
   - Monitor for vulnerabilities

### Getting Help

- Check the error logs: `GET /api/images/errors`
- Review system metrics: `GET /api/images/metrics`
- Test individual components using the provided endpoints
- Consult the implementation documentation for detailed architecture information 