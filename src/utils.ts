/**
 * Formats seconds into a clean MM:SS format.
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

/**
 * Builds a gorgeous, high-resolution Unsplash featured image URL using search keywords.
 * Utilizes a stable seed/ID so images stay consistent unless refreshed.
 */
export function getUnsplashUrl(keywords: string, seedId: string): string {
  const sanitized = encodeURIComponent(keywords.trim().replace(/\s+/g, ","));
  // Return high-quality, responsive featured image with specific size
  return `https://images.unsplash.com/featured/1280x720/?${sanitized}&sig=${seedId}`;
}

/**
 * Normalizes user-input transcripts to clean strings
 */
export function sanitizeTranscript(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ");
}
