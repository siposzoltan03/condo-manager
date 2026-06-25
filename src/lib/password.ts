import bcrypt from "bcryptjs";

/**
 * Centralized bcrypt cost factor. Increase over time as hardware improves.
 * 12 rounds ≈ 250ms on modern hardware (2024-2026).
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Hash a password with the standard bcrypt cost factor.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Shared password validation utility.
 *
 * Rules:
 * - Minimum 8 characters
 * - Maximum 72 characters (bcrypt truncates at 72 bytes)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (password.length > 72) {
    errors.push("Password must not exceed 72 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one digit");
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
