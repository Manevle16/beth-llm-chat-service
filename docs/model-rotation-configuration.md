# Model Rotation Configuration Guide

This document provides comprehensive information about configuring the model rotation system in the Beth LLM Chat Service.

## Overview

The model rotation system provides intelligent management of LLM models to optimize memory usage and performance. It automatically loads and unloads models based on usage patterns and system resources.

## Configuration Categories

### 1. Core Model Rotation Settings

#### `MODEL_ROTATION_ENABLED`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enables or disables the entire model rotation system
- **Example**: `MODEL_ROTATION_ENABLED=true`

#### `MAX_CONCURRENT_MODELS`
- **Type**: Integer
- **Default**: `1`
- **Range**: 1-10
- **Description**: Maximum number of models that can be loaded simultaneously
- **Example**: `MAX_CONCURRENT_MODELS=1`

#### `ROTATION_TIMEOUT_MS`
- **Type**: Integer (milliseconds)
- **Default**: `30000` (30 seconds)
- **Range**: 5000-300000
- **Description**: Maximum time to wait for model rotation operations
- **Example**: `ROTATION_TIMEOUT_MS=30000`

#### `ROTATION_RETRY_ATTEMPTS`
- **Type**: Integer
- **Default**: `3`
- **Range**: 0-10
- **Description**: Number of retry attempts for failed rotation operations
- **Example**: `ROTATION_RETRY_ATTEMPTS=3`

#### `ROTATION_RETRY_DELAY_MS`
- **Type**: Integer (milliseconds)
- **Default**: `1000` (1 second)
- **Range**: 100-10000
- **Description**: Base delay between retry attempts
- **Example**: `ROTATION_RETRY_DELAY_MS=1000`

### 2. Memory Monitoring Configuration

#### `MEMORY_WARNING_THRESHOLD`
- **Type**: Integer (percentage)
- **Default**: `70`
- **Range**: 50-95
- **Description**: Memory usage threshold that triggers warnings
- **Example**: `MEMORY_WARNING_THRESHOLD=70`

#### `MEMORY_CRITICAL_THRESHOLD`
- **Type**: Integer (percentage)
- **Default**: `85`
- **Range**: 60-98
- **Description**: Memory usage threshold that triggers critical alerts
- **Example**: `MEMORY_CRITICAL_THRESHOLD=85`

#### `MEMORY_CLEANUP_THRESHOLD`
- **Type**: Integer (percentage)
- **Default**: `90`
- **Range**: 70-99
- **Description**: Memory usage threshold that triggers automatic cleanup
- **Example**: `MEMORY_CLEANUP_THRESHOLD=90`

#### `MEMORY_MONITORING_ENABLED`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enables or disables memory monitoring
- **Example**: `MEMORY_MONITORING_ENABLED=true`

### 3. Queue Configuration

#### `MAX_QUEUE_SIZE`
- **Type**: Integer
- **Default**: `10`
- **Range**: 1-100
- **Description**: Maximum number of rotation requests in the queue
- **Example**: `MAX_QUEUE_SIZE=10`

#### `QUEUE_PROCESSING_INTERVAL_MS`
- **Type**: Integer (milliseconds)
- **Default**: `1000` (1 second)
- **Range**: 100-10000
- **Description**: Interval between queue processing cycles
- **Example**: `QUEUE_PROCESSING_INTERVAL_MS=1000`

### 4. Error Handling and Observability

#### `CIRCUIT_BREAKER_THRESHOLD`
- **Type**: Integer
- **Default**: `5`
- **Range**: 1-20
- **Description**: Number of consecutive failures before opening circuit breaker
- **Example**: `CIRCUIT_BREAKER_THRESHOLD=5`

#### `CIRCUIT_BREAKER_TIMEOUT_MS`
- **Type**: Integer (milliseconds)
- **Default**: `60000` (1 minute)
- **Range**: 10000-300000
- **Description**: Time to wait before attempting to close circuit breaker
- **Example**: `CIRCUIT_BREAKER_TIMEOUT_MS=60000`

#### `ERROR_RETRY_BASE_DELAY_MS`
- **Type**: Integer (milliseconds)
- **Default**: `1000` (1 second)
- **Range**: 100-10000
- **Description**: Base delay for exponential backoff retry logic
- **Example**: `ERROR_RETRY_BASE_DELAY_MS=1000`

#### `ERROR_RETRY_MAX_DELAY_MS`
- **Type**: Integer (milliseconds)
- **Default**: `30000` (30 seconds)
- **Range**: 5000-300000
- **Description**: Maximum delay for exponential backoff retry logic
- **Example**: `ERROR_RETRY_MAX_DELAY_MS=30000`

#### `ERROR_RETRY_BACKOFF_MULTIPLIER`
- **Type**: Number (float)
- **Default**: `2.0`
- **Range**: 1.1-5.0
- **Description**: Multiplier for exponential backoff calculation
- **Example**: `ERROR_RETRY_BACKOFF_MULTIPLIER=2.0`

#### `LOG_BUFFER_MAX_SIZE`
- **Type**: Integer
- **Default**: `1000`
- **Range**: 100-10000
- **Description**: Maximum number of log entries to keep in memory
- **Example**: `LOG_BUFFER_MAX_SIZE=1000`

### 5. Advanced Features

#### `ENABLE_ROTATION_HISTORY`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enables tracking of rotation history
- **Example**: `ENABLE_ROTATION_HISTORY=true`

#### `ROTATION_HISTORY_MAX_ENTRIES`
- **Type**: Integer
- **Default**: `100`
- **Range**: 10-1000
- **Description**: Maximum number of rotation history entries to keep
- **Example**: `ROTATION_HISTORY_MAX_ENTRIES=100`

#### `ENABLE_FAILED_ROTATION_TRACKING`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enables tracking of failed rotation attempts
- **Example**: `ENABLE_FAILED_ROTATION_TRACKING=true`

#### `FAILED_ROTATION_MAX_ENTRIES`
- **Type**: Integer
- **Default**: `50`
- **Range**: 10-500
- **Description**: Maximum number of failed rotation entries to keep
- **Example**: `FAILED_ROTATION_MAX_ENTRIES=50`

#### `ENABLE_MEMORY_TREND_ANALYSIS`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enables memory usage trend analysis
- **Example**: `ENABLE_MEMORY_TREND_ANALYSIS=true`

#### `MEMORY_TREND_WINDOW_MINUTES`
- **Type**: Integer (minutes)
- **Default**: `30`
- **Range**: 5-1440
- **Description**: Time window for memory trend analysis
- **Example**: `MEMORY_TREND_WINDOW_MINUTES=30`

## Configuration Examples

### Minimal Configuration
```bash
# Enable basic model rotation
MODEL_ROTATION_ENABLED=true
MAX_CONCURRENT_MODELS=1
```

### Production Configuration
```bash
# Core settings
MODEL_ROTATION_ENABLED=true
MAX_CONCURRENT_MODELS=2
ROTATION_TIMEOUT_MS=60000
ROTATION_RETRY_ATTEMPTS=5
ROTATION_RETRY_DELAY_MS=2000

# Memory monitoring
MEMORY_WARNING_THRESHOLD=75
MEMORY_CRITICAL_THRESHOLD=88
MEMORY_CLEANUP_THRESHOLD=92
MEMORY_MONITORING_ENABLED=true

# Queue settings
MAX_QUEUE_SIZE=20
QUEUE_PROCESSING_INTERVAL_MS=500

# Error handling
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_TIMEOUT_MS=120000
ERROR_RETRY_BASE_DELAY_MS=2000
ERROR_RETRY_MAX_DELAY_MS=60000
ERROR_RETRY_BACKOFF_MULTIPLIER=2.5

# Advanced features
ENABLE_ROTATION_HISTORY=true
ROTATION_HISTORY_MAX_ENTRIES=200
ENABLE_FAILED_ROTATION_TRACKING=true
FAILED_ROTATION_MAX_ENTRIES=100
ENABLE_MEMORY_TREND_ANALYSIS=true
MEMORY_TREND_WINDOW_MINUTES=60
```

### Development Configuration
```bash
# Relaxed settings for development
MODEL_ROTATION_ENABLED=true
MAX_CONCURRENT_MODELS=3
ROTATION_TIMEOUT_MS=15000
ROTATION_RETRY_ATTEMPTS=2
ROTATION_RETRY_DELAY_MS=500

# Less aggressive memory thresholds
MEMORY_WARNING_THRESHOLD=80
MEMORY_CRITICAL_THRESHOLD=90
MEMORY_CLEANUP_THRESHOLD=95

# Smaller queue for development
MAX_QUEUE_SIZE=5
QUEUE_PROCESSING_INTERVAL_MS=2000

# More lenient error handling
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_TIMEOUT_MS=30000
ERROR_RETRY_BASE_DELAY_MS=500
ERROR_RETRY_MAX_DELAY_MS=10000
ERROR_RETRY_BACKOFF_MULTIPLIER=1.5

# Limited history for development
ENABLE_ROTATION_HISTORY=true
ROTATION_HISTORY_MAX_ENTRIES=50
ENABLE_FAILED_ROTATION_TRACKING=true
FAILED_ROTATION_MAX_ENTRIES=25
ENABLE_MEMORY_TREND_ANALYSIS=false
```

## Configuration Validation

The system validates configuration values on startup and provides warnings for invalid settings. Common validation rules:

1. **Threshold Relationships**: Warning < Critical < Cleanup
2. **Timeout Values**: Must be reasonable for the operation
3. **Queue Sizes**: Must be positive and not excessive
4. **Retry Attempts**: Must be within reasonable bounds
5. **Memory Percentages**: Must be between 0-100

## Runtime Configuration Updates

Some configuration values can be updated at runtime:

- `MODEL_ROTATION_ENABLED` - Can be toggled via API
- `MAX_QUEUE_SIZE` - Can be adjusted (affects new requests)
- `LOG_BUFFER_MAX_SIZE` - Can be changed (affects new logs)

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Increase `MEMORY_CLEANUP_THRESHOLD`
   - Reduce `MAX_CONCURRENT_MODELS`
   - Enable `MEMORY_MONITORING_ENABLED`

2. **Slow Model Rotation**
   - Increase `ROTATION_TIMEOUT_MS`
   - Increase `ROTATION_RETRY_ATTEMPTS`
   - Adjust `ROTATION_RETRY_DELAY_MS`

3. **Queue Overflow**
   - Increase `MAX_QUEUE_SIZE`
   - Reduce `QUEUE_PROCESSING_INTERVAL_MS`
   - Check for stuck operations

4. **Frequent Circuit Breaker Trips**
   - Increase `CIRCUIT_BREAKER_THRESHOLD`
   - Increase `CIRCUIT_BREAKER_TIMEOUT_MS`
   - Check underlying Ollama service health

### Monitoring Configuration

Monitor these metrics to optimize configuration:

- Rotation success/failure rates
- Memory usage patterns
- Queue utilization
- Circuit breaker trip frequency
- Average rotation duration

## Best Practices

1. **Start Conservative**: Begin with minimal configuration and adjust based on usage
2. **Monitor Memory**: Keep memory thresholds below system limits
3. **Test Retry Logic**: Ensure retry settings work for your environment
4. **Balance Performance**: Trade off between memory usage and rotation speed
5. **Document Changes**: Keep track of configuration changes and their effects

## API Configuration Endpoints

The system provides API endpoints for runtime configuration:

- `GET /api/rotation/config` - Get current configuration
- `PUT /api/rotation/config` - Update configuration
- `POST /api/rotation/config/validate` - Validate configuration
- `GET /api/rotation/config/status` - Get configuration status

For more information about the API endpoints, see the API documentation. 