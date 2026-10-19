/**
 * Utility functions for handling product image URLs.
 * Supports single URLs, comma-separated URLs, or JSON array strings.
 */
export function getProductImages(imageUrl?: string | string[] | null): string[] {
  if (!imageUrl) return [];
  if (Array.isArray(imageUrl)) {
    return imageUrl.map((item) => String(item).trim()).filter(Boolean);
  }
  const trimmed = imageUrl.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item: unknown) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fallback to comma separated
    }
  }

  return trimmed
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

export function getProductPrimaryImage(imageUrl?: string | string[] | null): string {
  const images = getProductImages(imageUrl);
  return images[0] || '';
}
