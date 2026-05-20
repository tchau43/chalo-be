/**
 * Centralized constants for cross-cutting business values.
 * Tránh magic numbers rải rác trong code.
 */

export const BCRYPT_SALT_ROUNDS = 10;

export const UPLOAD_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPLOAD_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const HTTP_BODY_LIMIT = '1mb';

export const THROTTLE_TTL_MS = 60_000;
export const THROTTLE_LIMIT = 100;

/** Số barista phục vụ song song (dùng để ước lượng wait time) */
export const ESTIMATED_WAIT_BARISTAS = 3;

/** Giới hạn pagination để chống abuse */
export const PAGINATION_MAX_PAGE_SIZE = 100;
export const PAGINATION_DEFAULT_PAGE_SIZE = 20;
