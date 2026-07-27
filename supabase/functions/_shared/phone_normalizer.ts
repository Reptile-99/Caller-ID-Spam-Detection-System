/**
 * Phone Number Normalization and Validation Utility for E.164 Format
 * Compliant with ITU-T E.164 Standard (Max 15 digits, starting with country code)
 */

export interface ContactInput {
  name: string;
  phone: string;
}

export interface NormalizedContact {
  phone_number: string;
  name: string;
}

/**
 * Normalizes a raw phone string into standard E.164 format (+[1-9]\d{6,14})
 * 
 * @param rawPhone - Raw phone string input (e.g. "+1 (415) 555-2671", "01712345678")
 * @param defaultCountryCode - Fallback international country code without '+' (e.g. "1", "880")
 * @returns E.164 formatted string or null if invalid
 */
export function normalizeToE164(rawPhone: string, defaultCountryCode: string = "1"): string | null {
  if (!rawPhone || typeof rawPhone !== "string") return null;

  // 1. Trim whitespace & leading/trailing non-digit noise
  let cleaned = rawPhone.trim();

  // Handle leading '00' international prefix (e.g., 0044123456789 -> +44123456789)
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Check if string already starts with '+'
  const hasPlus = cleaned.startsWith("+");

  // Remove all non-numeric characters (keep only digits)
  const digitsOnly = cleaned.replace(/\D/g, "");

  if (!digitsOnly) return null;

  let e164Result = "";

  if (hasPlus) {
    e164Result = `+${digitsOnly}`;
  } else {
    // If phone starts with local leading zero '0', strip it and prepend default country code
    if (digitsOnly.startsWith("0")) {
      const nationalNumber = digitsOnly.replace(/^0+/, "");
      const cc = defaultCountryCode.replace(/\D/g, "");
      e164Result = `+${cc}${nationalNumber}`;
    } else {
      // If no leading zero or plus, check if digits already include country code or append default CC
      const cc = defaultCountryCode.replace(/\D/g, "");
      if (digitsOnly.length > 10 && (digitsOnly.startsWith(cc) || digitsOnly.length >= 11)) {
        e164Result = `+${digitsOnly}`;
      } else {
        e164Result = `+${cc}${digitsOnly}`;
      }
    }
  }

  // 2. Validate against ITU E.164 Regex (+ followed by 7 to 15 digits, first non-zero)
  const E164_REGEX = /^\+[1-9]\d{6,14}$/;
  if (!E164_REGEX.test(e164Result)) {
    return null;
  }

  return e164Result;
}

/**
 * Normalizes contact names (collapses whitespace, caps length, strips illegal control chars)
 */
export function normalizeContactName(rawName: string): string | null {
  if (!rawName || typeof rawName !== "string") return null;

  // Remove control characters and collapse multiple spaces into one
  const cleaned = rawName
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return null;

  // Truncate to maximum 255 chars for database column constraint
  return cleaned.slice(0, 255);
}
