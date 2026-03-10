/**
 * Delivery Encryption Utilities
 *
 * Handles encryption and decryption of instant delivery codes/credentials.
 * Uses AES-256-GCM for secure encryption with authentication.
 *
 * Security Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Unique IV (initialization vector) for each encryption
 * - SHA-256 hashing for duplicate detection
 * - Server-side only (never expose keys to client)
 */

import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // For AES, this is always 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits
const ITERATIONS = 100000 // PBKDF2 iterations

// Get encryption key from environment or generate one
function getEncryptionKey(): string {
  const envKey = process.env.DELIVERY_ENCRYPTION_KEY

  if (!envKey) {
    console.warn('⚠️  DELIVERY_ENCRYPTION_KEY not set in environment. Using default key. THIS IS INSECURE FOR PRODUCTION!')
    // Default key for development only
    return 'dev-encryption-key-change-in-production-32chars-minimum'
  }

  if (envKey.length < 32) {
    throw new Error('DELIVERY_ENCRYPTION_KEY must be at least 32 characters long')
  }

  return envKey
}

/**
 * Derive a cryptographic key from the master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha256'
  )
}

/**
 * Encrypt delivery data (code, credentials, etc.)
 * Returns base64-encoded encrypted data with IV and auth tag
 */
export function encryptDeliveryData(plaintext: string): string {
  try {
    const masterKey = getEncryptionKey()

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    // Derive encryption key from master key
    const key = deriveKey(masterKey, salt)

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Get authentication tag
    const authTag = cipher.getAuthTag()

    // Combine salt + IV + encrypted data + auth tag
    const combined = Buffer.concat([
      salt,
      iv,
      Buffer.from(encrypted, 'hex'),
      authTag
    ])

    // Return as base64
    return combined.toString('base64')

  } catch (error) {
    console.error('❌ Encryption error:', error)
    throw new Error('Failed to encrypt delivery data')
  }
}

/**
 * Decrypt delivery data
 * Takes base64-encoded encrypted data and returns plaintext
 */
export function decryptDeliveryData(encryptedData: string): string {
  try {
    const masterKey = getEncryptionKey()

    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64')

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const encrypted = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      combined.length - TAG_LENGTH
    )
    const authTag = combined.subarray(combined.length - TAG_LENGTH)

    // Derive key from master key
    const key = deriveKey(masterKey, salt)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    // Decrypt the data
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')

  } catch (error) {
    console.error('❌ Decryption error:', error)
    throw new Error('Failed to decrypt delivery data')
  }
}

/**
 * Create SHA-256 hash of code for duplicate detection
 * This allows checking for duplicates without storing plaintext
 */
export function hashCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code.trim().toLowerCase())
    .digest('hex')
}

/**
 * Validate code format based on delivery type
 */
export function validateCodeFormat(
  code: string,
  deliveryType: 'code' | 'credentials' | 'key' | 'gift_card'
): { valid: boolean; error?: string } {
  const trimmedCode = code.trim()

  if (!trimmedCode) {
    return { valid: false, error: 'Code cannot be empty' }
  }

  switch (deliveryType) {
    case 'credentials':
      // Format: username:password or email:password
      if (!trimmedCode.includes(':')) {
        return {
          valid: false,
          error: 'Credentials must be in format: username:password or email:password'
        }
      }
      const parts = trimmedCode.split(':')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return {
          valid: false,
          error: 'Invalid credentials format. Must have both username and password'
        }
      }
      break

    case 'code':
    case 'key':
    case 'gift_card':
      // Generic validation - at least 4 characters
      if (trimmedCode.length < 4) {
        return {
          valid: false,
          error: 'Code must be at least 4 characters long'
        }
      }
      break

    default:
      return { valid: false, error: 'Invalid delivery type' }
  }

  return { valid: true }
}

/**
 * Parse and validate multiple codes from textarea input
 */
export function parseCodesFromText(
  text: string,
  deliveryType: 'code' | 'credentials' | 'key' | 'gift_card'
): {
  valid: string[]
  invalid: Array<{ line: number; code: string; error: string }>
  duplicates: string[]
} {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  const valid: string[] = []
  const invalid: Array<{ line: number; code: string; error: string }> = []
  const seen = new Set<string>()
  const duplicates: string[] = []

  lines.forEach((line, index) => {
    // Check for duplicates (case-insensitive)
    const normalized = line.toLowerCase()
    if (seen.has(normalized)) {
      duplicates.push(line)
      return
    }

    // Validate format
    const validation = validateCodeFormat(line, deliveryType)
    if (!validation.valid) {
      invalid.push({
        line: index + 1,
        code: line,
        error: validation.error || 'Invalid format'
      })
      return
    }

    seen.add(normalized)
    valid.push(line)
  })

  return { valid, invalid, duplicates }
}

/**
 * Sanitize code for display (hide sensitive parts)
 * Used for showing preview without exposing full code
 */
export function sanitizeCodeForDisplay(code: string, deliveryType: 'code' | 'credentials' | 'key' | 'gift_card'): string {
  if (deliveryType === 'credentials') {
    const parts = code.split(':')
    if (parts.length === 2) {
      const [username, password] = parts
      return `${username}:${'*'.repeat(password.length)}`
    }
  }

  // For other types, show first 4 and last 4 characters
  if (code.length <= 8) {
    return '*'.repeat(code.length)
  }

  return `${code.substring(0, 4)}${'*'.repeat(code.length - 8)}${code.substring(code.length - 4)}`
}

/**
 * Generate encryption statistics for monitoring
 */
export function getEncryptionStats() {
  return {
    algorithm: ALGORITHM,
    keyLength: KEY_LENGTH * 8, // in bits
    ivLength: IV_LENGTH,
    iterations: ITERATIONS,
    isProduction: !!process.env.DELIVERY_ENCRYPTION_KEY
  }
}
