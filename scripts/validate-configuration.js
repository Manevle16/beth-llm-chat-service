#!/usr/bin/env node

/**
 * Configuration Validation Script
 * 
 * This script validates the model rotation configuration settings
 * and provides detailed feedback about any issues found.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

dotenv.config({ path: envPath });

// Configuration validation rules
const validationRules = {
  // Core Model Rotation Settings
  MODEL_ROTATION_ENABLED: {
    type: 'boolean',
    required: false,
    default: true,
    validator: (value) => typeof value === 'boolean' || value === 'true' || value === 'false'
  },
  MAX_CONCURRENT_MODELS: {
    type: 'integer',
    required: false,
    default: 1,
    range: [1, 10],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 1 && num <= 10;
    }
  },
  ROTATION_TIMEOUT_MS: {
    type: 'integer',
    required: false,
    default: 30000,
    range: [5000, 300000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 5000 && num <= 300000;
    }
  },
  ROTATION_RETRY_ATTEMPTS: {
    type: 'integer',
    required: false,
    default: 3,
    range: [0, 10],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 0 && num <= 10;
    }
  },
  ROTATION_RETRY_DELAY_MS: {
    type: 'integer',
    required: false,
    default: 1000,
    range: [100, 10000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 100 && num <= 10000;
    }
  },

  // Memory Monitoring Configuration
  MEMORY_WARNING_THRESHOLD: {
    type: 'integer',
    required: false,
    default: 70,
    range: [50, 95],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 50 && num <= 95;
    }
  },
  MEMORY_CRITICAL_THRESHOLD: {
    type: 'integer',
    required: false,
    default: 85,
    range: [60, 98],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 60 && num <= 98;
    }
  },
  MEMORY_CLEANUP_THRESHOLD: {
    type: 'integer',
    required: false,
    default: 90,
    range: [70, 99],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 70 && num <= 99;
    }
  },
  MEMORY_MONITORING_ENABLED: {
    type: 'boolean',
    required: false,
    default: true,
    validator: (value) => typeof value === 'boolean' || value === 'true' || value === 'false'
  },

  // Queue Configuration
  MAX_QUEUE_SIZE: {
    type: 'integer',
    required: false,
    default: 10,
    range: [1, 100],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 1 && num <= 100;
    }
  },
  QUEUE_PROCESSING_INTERVAL_MS: {
    type: 'integer',
    required: false,
    default: 1000,
    range: [100, 10000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 100 && num <= 10000;
    }
  },

  // Error Handling and Observability
  CIRCUIT_BREAKER_THRESHOLD: {
    type: 'integer',
    required: false,
    default: 5,
    range: [1, 20],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 1 && num <= 20;
    }
  },
  CIRCUIT_BREAKER_TIMEOUT_MS: {
    type: 'integer',
    required: false,
    default: 60000,
    range: [10000, 300000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 10000 && num <= 300000;
    }
  },
  ERROR_RETRY_BASE_DELAY_MS: {
    type: 'integer',
    required: false,
    default: 1000,
    range: [100, 10000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 100 && num <= 10000;
    }
  },
  ERROR_RETRY_MAX_DELAY_MS: {
    type: 'integer',
    required: false,
    default: 30000,
    range: [5000, 300000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 5000 && num <= 300000;
    }
  },
  ERROR_RETRY_BACKOFF_MULTIPLIER: {
    type: 'float',
    required: false,
    default: 2.0,
    range: [1.1, 5.0],
    validator: (value) => {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 1.1 && num <= 5.0;
    }
  },
  LOG_BUFFER_MAX_SIZE: {
    type: 'integer',
    required: false,
    default: 1000,
    range: [100, 10000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 100 && num <= 10000;
    }
  },

  // Advanced Features
  ENABLE_ROTATION_HISTORY: {
    type: 'boolean',
    required: false,
    default: true,
    validator: (value) => typeof value === 'boolean' || value === 'true' || value === 'false'
  },
  ROTATION_HISTORY_MAX_ENTRIES: {
    type: 'integer',
    required: false,
    default: 100,
    range: [10, 1000],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 10 && num <= 1000;
    }
  },
  ENABLE_FAILED_ROTATION_TRACKING: {
    type: 'boolean',
    required: false,
    default: true,
    validator: (value) => typeof value === 'boolean' || value === 'true' || value === 'false'
  },
  FAILED_ROTATION_MAX_ENTRIES: {
    type: 'integer',
    required: false,
    default: 50,
    range: [10, 500],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 10 && num <= 500;
    }
  },
  ENABLE_MEMORY_TREND_ANALYSIS: {
    type: 'boolean',
    required: false,
    default: true,
    validator: (value) => typeof value === 'boolean' || value === 'true' || value === 'false'
  },
  MEMORY_TREND_WINDOW_MINUTES: {
    type: 'integer',
    required: false,
    default: 30,
    range: [5, 1440],
    validator: (value) => {
      const num = parseInt(value);
      return !isNaN(num) && num >= 5 && num <= 1440;
    }
  }
};

/**
 * Validate a single configuration value
 * @param {string} key - Configuration key
 * @param {string} value - Configuration value
 * @param {Object} rule - Validation rule
 * @returns {Object} Validation result
 */
function validateConfigValue(key, value, rule) {
  const result = {
    key,
    value,
    isValid: true,
    errors: [],
    warnings: [],
    usedDefault: false
  };

  // Check if value is provided
  if (value === undefined || value === null || value === '') {
    if (rule.required) {
      result.isValid = false;
      result.errors.push(`Required configuration '${key}' is missing`);
    } else {
      result.value = rule.default;
      result.usedDefault = true;
      result.warnings.push(`Using default value: ${rule.default}`);
    }
  } else {
    // Validate the value
    if (!rule.validator(value)) {
      result.isValid = false;
      result.errors.push(`Invalid value '${value}' for ${key}. Expected ${rule.type} in range [${rule.range[0]}, ${rule.range[1]}]`);
    } else {
      // Convert to appropriate type
      if (rule.type === 'integer') {
        result.value = parseInt(value);
      } else if (rule.type === 'float') {
        result.value = parseFloat(value);
      } else if (rule.type === 'boolean') {
        result.value = value === 'true' || value === true;
      } else {
        result.value = value;
      }
    }
  }

  return result;
}

/**
 * Validate memory threshold relationships
 * @param {Object} config - Configuration object
 * @returns {Array} Validation errors
 */
function validateMemoryThresholds(config) {
  const errors = [];
  
  const warning = config.MEMORY_WARNING_THRESHOLD;
  const critical = config.MEMORY_CRITICAL_THRESHOLD;
  const cleanup = config.MEMORY_CLEANUP_THRESHOLD;

  if (warning && critical && warning >= critical) {
    errors.push(`MEMORY_WARNING_THRESHOLD (${warning}) must be less than MEMORY_CRITICAL_THRESHOLD (${critical})`);
  }

  if (critical && cleanup && critical >= cleanup) {
    errors.push(`MEMORY_CRITICAL_THRESHOLD (${critical}) must be less than MEMORY_CLEANUP_THRESHOLD (${cleanup})`);
  }

  if (warning && cleanup && warning >= cleanup) {
    errors.push(`MEMORY_WARNING_THRESHOLD (${warning}) must be less than MEMORY_CLEANUP_THRESHOLD (${cleanup})`);
  }

  return errors;
}

/**
 * Validate timeout relationships
 * @param {Object} config - Configuration object
 * @returns {Array} Validation errors
 */
function validateTimeoutRelationships(config) {
  const errors = [];
  
  const retryDelay = config.ROTATION_RETRY_DELAY_MS;
  const timeout = config.ROTATION_TIMEOUT_MS;
  const retryAttempts = config.ROTATION_RETRY_ATTEMPTS;

  if (retryDelay && timeout && retryAttempts) {
    const maxRetryTime = retryDelay * retryAttempts;
    if (maxRetryTime > timeout) {
      errors.push(`Total retry time (${retryDelay}ms × ${retryAttempts} = ${maxRetryTime}ms) exceeds ROTATION_TIMEOUT_MS (${timeout}ms)`);
    }
  }

  return errors;
}

/**
 * Main validation function
 * @returns {Object} Validation results
 */
function validateConfiguration() {
  console.log('🔍 Validating Model Rotation Configuration...\n');

  const results = {
    isValid: true,
    errors: [],
    warnings: [],
    validatedConfig: {},
    summary: {
      total: 0,
      valid: 0,
      invalid: 0,
      usingDefaults: 0
    }
  };

  // Validate each configuration value
  for (const [key, rule] of Object.entries(validationRules)) {
    results.summary.total++;
    const value = process.env[key];
    const result = validateConfigValue(key, value, rule);
    
    results.validatedConfig[key] = result.value;
    
    if (result.isValid) {
      results.summary.valid++;
      if (result.usedDefault) {
        results.summary.usingDefaults++;
        results.warnings.push(...result.warnings);
      }
    } else {
      results.summary.invalid++;
      results.isValid = false;
      results.errors.push(...result.errors);
    }
  }

  // Validate relationships
  const thresholdErrors = validateMemoryThresholds(results.validatedConfig);
  const timeoutErrors = validateTimeoutRelationships(results.validatedConfig);
  
  results.errors.push(...thresholdErrors, ...timeoutErrors);
  if (thresholdErrors.length > 0 || timeoutErrors.length > 0) {
    results.isValid = false;
  }

  return results;
}

/**
 * Print validation results
 * @param {Object} results - Validation results
 */
function printResults(results) {
  console.log('📊 Configuration Validation Results:\n');

  // Print summary
  console.log(`✅ Valid configurations: ${results.summary.valid}/${results.summary.total}`);
  console.log(`❌ Invalid configurations: ${results.summary.invalid}`);
  console.log(`⚠️  Using defaults: ${results.summary.usingDefaults}\n`);

  // Print warnings
  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    results.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
    console.log('');
  }

  // Print errors
  if (results.errors.length > 0) {
    console.log('❌ Errors:');
    results.errors.forEach(error => {
      console.log(`   - ${error}`);
    });
    console.log('');
  }

  // Print final result
  if (results.isValid) {
    console.log('🎉 Configuration validation passed!');
  } else {
    console.log('💥 Configuration validation failed!');
    process.exit(1);
  }

  // Print current configuration
  console.log('\n📋 Current Configuration:');
  for (const [key, value] of Object.entries(results.validatedConfig)) {
    console.log(`   ${key}=${value}`);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = validateConfiguration();
  printResults(results);
}

export { validateConfiguration, validationRules }; 