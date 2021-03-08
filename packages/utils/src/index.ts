/**
 * Return a slugified copy of a string.
 *
 * @param string - The string to be slugified
 */
export function toSlug(str: string): string {
  let s = str;
  if (!s) {
    return '';
  }
  s = s.toLowerCase().trim();
  s = s.replace(/ & /g, ' and ');
  s = s.replace(/[ ]+/g, '-');
  s = s.replace(/[-]+/g, '-');
  s = s.replace(/[^a-z0-9-]+/g, '');
  s = s.length > 32 ? s.substr(0, 32) : s;
  return s;
}

/**
 * Convert a phone number from E.164 format into (212)-555-9656 format
 * @param phone - An unformatted 12-digit phone number string
 */
export function fromPhoneE164(phone: string): string {
  if (phone.length === 12) {
    return (
      phone.substring(2, 5) +
      '-' +
      phone.substring(5, 8) +
      '-' +
      phone.substring(8, 12)
    );
  } else {
    return phone;
  }
}

/**
 * Convert a phone number into E.164 format.
 */
export function toPhoneE164(phone: string): string {
  phone = phone.replace(/[^0-9]/g, '');
  if (phone.length === 10) {
    phone = '1' + phone;
  }
  return '+' + phone;
}

/**
 * Add two numbers together
 */
export function sum(a: number, b: number): number {
  return a + b;
}
