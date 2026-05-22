import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const resolveEnvValue = (key) => {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const supabaseUrl = resolveEnvValue('SUPABASE_URL') || resolveEnvValue('VITE_SUPABASE_URL');
const supabaseServiceRoleKey = resolveEnvValue('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) environment variable.');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

const filePath = path.resolve('src/data/tulipProducts.json');
const rawProducts = JSON.parse(fs.readFileSync(filePath, 'utf8'));

if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
  throw new Error('No products found in src/data/tulipProducts.json');
}

const normalizeNotableEffects = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const products = rawProducts.map((product) => ({
  id: String(product.id),
  name: String(product.name || 'Untitled Product'),
  brand: String(product.brand || 'Unknown Brand'),
  description: product.description ?? null,
  price: Number(normalizeNumber(product.price, 0).toFixed(2)),
  original_price:
    product.originalPrice == null
      ? null
      : Number(normalizeNumber(product.originalPrice, 0).toFixed(2)),
  image_url: String(product.image || ''),
  hover_image_url: product.hoverImage ?? null,
  gender: String(product.gender || 'Unisex'),
  master_category: String(product.masterCategory || 'Apparel'),
  sub_category: String(product.subCategory || 'General'),
  article_type: String(product.articleType || 'General'),
  base_colour: product.baseColour ?? null,
  season: product.season ?? null,
  year: Number.isFinite(Number(product.year)) ? Number(product.year) : null,
  usage: product.usage ?? null,
  category: String(product.category || 'general'),
  rating: Math.max(0, Math.min(5, Number(normalizeNumber(product.rating, 0).toFixed(2)))),
  reviews: Math.max(0, Math.floor(normalizeNumber(product.reviews, 0))),
  is_new: Boolean(product.isNew),
  is_trending: Boolean(product.isTrending),
  is_ai_pick: Boolean(product.isAIPick),
  colors: Array.isArray(product.colors) ? product.colors.map(String) : [],
  sizes: Array.isArray(product.sizes) ? product.sizes.map(String) : [],
  material: product.material ?? null,
  fit: product.fit ?? null,
  skin_type: product.skinType ?? null,
  notable_effects: normalizeNotableEffects(product.notableEffects),
  stock: Number.isFinite(Number(product.stock))
    ? Math.max(0, Math.floor(Number(product.stock)))
    : 50,
}));

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const batchSize = 200;
let upserted = 0;

for (let index = 0; index < products.length; index += batchSize) {
  const batch = products.slice(index, index + batchSize);

  const { error } = await supabase
    .from('products')
    .upsert(batch, { onConflict: 'id' });

  if (error) {
    throw new Error(`Batch ${index / batchSize + 1} failed: ${error.message}`);
  }

  upserted += batch.length;
}

console.log(`Seeded/updated ${upserted} products into Supabase.`);
