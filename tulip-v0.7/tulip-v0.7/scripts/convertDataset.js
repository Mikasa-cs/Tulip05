#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = path.join(__dirname, '../tulip dataset/styles.csv');
const IMAGE_CSV_PATH = path.join(__dirname, '../tulip dataset/image.csv');
const SKINCARE_CSV_PATH = path.join(__dirname, '../tulip dataset/Skin Care.csv');
const OUTPUT_PATH = path.join(__dirname, '../src/data/tulipProducts.json');

// Sample size - set to 20000 for performance, adjust as needed
const SAMPLE_SIZE = 20000;

// Load image URL mapping from image.csv (productId -> imageUrl)
async function loadImageMap() {
  const imageMap = new Map();
  const fileStream = fs.createReadStream(IMAGE_CSV_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    const parts = line.split(',');
    if (parts.length >= 2) {
      const productId = parts[0].trim();
      const imageUrl = parts[1].trim();
      imageMap.set(productId, imageUrl);
    }
  }
  console.log(`🖼️  Loaded ${imageMap.size} image URLs from image.csv`);
  return imageMap;
}

async function convertCsvToJson() {
  try {
    console.log('🎨 Starting Tulip Dataset Conversion...\n');

    const imageMap = await loadImageMap();

    const fileStream = fs.createReadStream(CSV_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineCount = 0;
    let products = [];
    let headers = [];

    for await (const line of rl) {
      if (lineCount === 0) {
        // Parse header
        headers = line.split(',');
        console.log(`📋 Headers: ${headers.join(', ')}`);
      } else {
        // Parse data row
        const values = parseCSVLine(line);
        const product = mapToProduct(headers, values, lineCount, imageMap);
        if (product) {
          products.push(product);
        }

        // Limit to sample size
        if (lineCount >= SAMPLE_SIZE) {
          console.log(`\n⚠️  Limiting to first ${SAMPLE_SIZE} products for performance.\n`);
          break;
        }

        if (lineCount % 1000 === 0) {
          console.log(`✓ Processed ${lineCount} products...`);
        }
      }
      lineCount++;
    }

    if (products.length === 0) {
      throw new Error('No products were parsed from CSV');
    }

    // Load skincare products
    console.log('\n🧴 Loading Skincare dataset...');
    const skincareProducts = await loadSkincareProducts();
    console.log(`🧴 Loaded ${skincareProducts.length} skincare products`);
    products = products.concat(skincareProducts);

    // Write JSON output
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(products, null, 2));

    console.log(`\n✅ Conversion Complete!`);
    console.log(`📊 Total products: ${products.length} (${products.length - skincareProducts.length} fashion + ${skincareProducts.length} skincare)`);
    console.log(`💾 Output file: ${OUTPUT_PATH}`);
    console.log(`\n📈 Sample product:`, JSON.stringify(products[0], null, 2));
  } catch (error) {
    console.error('❌ Error converting dataset:', error);
    process.exit(1);
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function mapToProduct(headers, values, id, imageMap) {
  try {
    const data = {};
    headers.forEach((header, index) => {
      data[header] = values[index];
    });

    const productId = data.id || String(id);
    const imageUrl = imageMap.get(productId) || `https://via.placeholder.com/300x400?text=${encodeURIComponent(data.productDisplayName || 'Product')}`;

    // Generate various random but consistent attributes
    const basePrice = 50 + Math.random() * 450;
    const discountPercent = Math.random() > 0.7 ? Math.floor(20 + Math.random() * 40) : 0;

    return {
      id: productId,
      name: data.productDisplayName || 'Unknown Product',
      brand: extractBrand(data.productDisplayName || ''),
      price: Math.round(basePrice * 100) / 100,
      originalPrice: discountPercent > 0 ? Math.round((basePrice / (1 - discountPercent / 100)) * 100) / 100 : undefined,
      image: imageUrl,
      gender: capitalizeFirstLetter(data.gender) || 'Unisex',
      masterCategory: data.masterCategory || 'Accessories',
      subCategory: data.subCategory || 'Other',
      articleType: data.articleType || 'Item',
      baseColour: data.baseColour || 'Gray',
      season: data.season || 'Summer',
      year: parseInt(data.year) || new Date().getFullYear(),
      usage: data.usage || 'Casual',
      category: getCategoryMapping(data.gender, data.masterCategory),
      rating: (3.5 + Math.random() * 1.5),
      reviews: Math.floor(Math.random() * 500),
      isNew: Math.random() > 0.8,
      isTrending: Math.random() > 0.75,
      isAIPick: Math.random() > 0.85,
    };
  } catch (error) {
    console.warn(`⚠️  Error mapping product at row ${id}:`, error.message);
    return null;
  }
}

function extractBrand(productName) {
  // Try to extract brand from product name
  const parts = productName.split(' ');
  return parts[0] || 'Brand';
}

function capitalizeFirstLetter(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

function getCategoryMapping(gender, masterCategory) {
  const genderMap = {
    'men': 'men',
    'women': 'women',
    'boys': 'kids',
    'girls': 'kids',
    'unisex': 'accessories',
  };
  const category = genderMap[gender?.toLowerCase()] || 'accessories';
  
  if (masterCategory?.toLowerCase() === 'personal care') {
    return 'beauty';
  }
  if (masterCategory?.toLowerCase() === 'footwear') {
    return 'footwear';
  }
  return category;
}

async function loadSkincareProducts() {
  const products = [];
  const fileStream = fs.createReadStream(SKINCARE_CSV_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let headers = [];
  let lineCount = 0;

  for await (const line of rl) {
    if (lineCount === 0) {
      headers = parseCSVLine(line);
      console.log(`📋 Skincare headers: ${headers.join(', ')}`);
    } else {
      const values = parseCSVLine(line);
      const data = {};
      headers.forEach((h, i) => { data[h.trim()] = (values[i] || '').trim(); });

      // Parse price: "Rp 209.000" -> number (Indonesian Rupiah, dot = thousands separator)
      let price = 0;
      const priceStr = data.price || '';
      const priceMatch = priceStr.replace(/[^0-9.]/g, '');
      if (priceMatch) {
        // "209.000" means 209000 IDR -> convert to approx INR (1 IDR ≈ 0.0053 INR)
        price = Math.round(parseFloat(priceMatch.replace(/\./g, '')) * 0.0053 * 100) / 100;
        if (isNaN(price) || price <= 0) price = Math.round((100 + Math.random() * 400) * 100) / 100;
      } else {
        price = Math.round((100 + Math.random() * 400) * 100) / 100;
      }

      const discountPercent = Math.random() > 0.7 ? Math.floor(10 + Math.random() * 30) : 0;

      const product = {
        id: `sc-${lineCount}`,
        name: data.product_name || 'Skincare Product',
        brand: (data.brand || 'Brand').trim(),
        price,
        originalPrice: discountPercent > 0 ? Math.round((price / (1 - discountPercent / 100)) * 100) / 100 : undefined,
        image: data.picture_src || '',
        gender: 'Unisex',
        masterCategory: 'Skincare',
        subCategory: data.product_type || 'Skincare',
        articleType: data.product_type || 'Skincare',
        baseColour: 'White',
        season: 'Summer',
        year: new Date().getFullYear(),
        usage: 'Casual',
        category: 'skincare',
        rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
        reviews: Math.floor(Math.random() * 500),
        isNew: Math.random() > 0.8,
        isTrending: Math.random() > 0.75,
        isAIPick: Math.random() > 0.85,
        description: data.description || '',
        skinType: data.skintype || '',
        notableEffects: data.notable_effects || '',
      };

      if (product.name && product.image) {
        products.push(product);
      }
    }
    lineCount++;
  }
  return products;
}

// Run the conversion
convertCsvToJson();
