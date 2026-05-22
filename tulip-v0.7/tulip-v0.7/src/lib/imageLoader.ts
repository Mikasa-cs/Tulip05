/**
 * Image loader utility - Maps product IDs to image URLs from image.csv
 */

export interface ImageMapping {
  productId: string;
  imageUrl: string;
  imageFileName: string;
}

// Store the image mappings in memory
let imageCache: Map<string, ImageMapping> | null = null;

/**
 * Parse CSV data into ImageMapping objects
 */
function parseImageCSV(csvText: string): Map<string, ImageMapping> {
  const lines = csvText.trim().split('\n');
  const imageMap = new Map<string, ImageMapping>();
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 3) {
      const mapping: ImageMapping = {
        productId: parts[0].trim(),
        imageUrl: parts[1].trim(),
        imageFileName: parts[2].trim(),
      };
      imageMap.set(mapping.productId, mapping);
    }
  }
  
  return imageMap;
}

/**
 * Get image URL for a product ID
 */
export async function getProductImage(productId: string): Promise<string | null> {
  try {
    // Load cache if not already loaded
    if (!imageCache) {
      const response = await fetch('/tulip dataset/image.csv');
      const csvText = await response.text();
      imageCache = parseImageCSV(csvText);
    }
    
    const mapping = imageCache.get(productId);
    return mapping?.imageUrl || null;
  } catch (error) {
    console.warn(`Failed to load image for product ${productId}:`, error);
    return null;
  }
}

/**
 * Get all image mappings
 */
export async function getAllImageMappings(): Promise<Map<string, ImageMapping>> {
  if (!imageCache) {
    try {
      const response = await fetch('/tulip dataset/image.csv');
      const csvText = await response.text();
      imageCache = parseImageCSV(csvText);
    } catch (error) {
      console.warn('Failed to load image mappings:', error);
      imageCache = new Map();
    }
  }
  
  return imageCache;
}

/**
 * Load images synchronously from a static import (for better performance)
 */
export function loadImageMappingsSync(csvData: string): Map<string, ImageMapping> {
  return parseImageCSV(csvData);
}
