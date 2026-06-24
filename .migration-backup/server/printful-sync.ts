/**
 * Printful Sync Service
 * 
 * This module provides synchronization functionality between Printful and our local database.
 * It ensures that products from Printful are properly reflected in our local database
 * so they can be shown in the storefront.
 */

import * as printfulService from './printful-service';
import { storage } from './storage';
import { ProductCategory, ProductStatus, PrintProvider } from '@shared/schema';

/**
 * Maps Printful product types to our internal product categories
 * @param printfulType - The product type from Printful
 * @returns The product category as a string
 */
/**
 * Maps Printful product types to our internal product categories
 * Ensures we return a valid category from our enum
 * @param productName - The product name from Printful (used for better categorization)
 * @param printfulType - The product type from Printful
 * @returns A valid product category from our enum
 */
function mapPrintfulTypeToCategory(productName: string, printfulType?: string): "apparel" | "home" | "accessories" {
  // Check product name first as it's more descriptive
  const nameCheck = productName ? productName.toLowerCase() : '';
  
  // Check for home items in product name
  if (nameCheck.includes('mug') || 
      nameCheck.includes('ceramic') ||
      nameCheck.includes('pillow') || 
      nameCheck.includes('poster') || 
      nameCheck.includes('canvas') ||
      nameCheck.includes('blanket') ||
      nameCheck.includes('towel')) {
    return "home";
  }
  
  // Check for apparel items in product name
  if (nameCheck.includes('shirt') || 
      nameCheck.includes('hoodie') || 
      nameCheck.includes('sweater') || 
      nameCheck.includes('jacket') ||
      nameCheck.includes('tank') ||
      nameCheck.includes('tee')) {
    return "apparel";
  }
  
  // Fall back to product type if available
  if (printfulType) {
    const typeCheck = printfulType.toLowerCase();
    
    if (typeCheck.includes('shirt') || 
        typeCheck.includes('hoodie') || 
        typeCheck.includes('sweater') || 
        typeCheck.includes('jacket') ||
        typeCheck.includes('apparel')) {
      return "apparel";
    }
    
    if (typeCheck.includes('mug') || 
        typeCheck.includes('pillow') || 
        typeCheck.includes('poster') || 
        typeCheck.includes('canvas') ||
        typeCheck.includes('home')) {
      return "home";
    }
  }
  
  // Default to accessories for other product types
  return "accessories";
}

/**
 * Converts price from Printful format to our database format
 * @param printfulPrice - Price from Printful API (in cents)
 * @returns number - Price in dollars
 */
function convertPrintfulPrice(printfulPrice: string | number): number {
  const price = typeof printfulPrice === 'string' ? 
    parseFloat(printfulPrice) : printfulPrice;
  
  // Printful returns prices in cents, convert to dollars with 2 decimal precision
  return parseFloat((price / 100).toFixed(2));
}

/**
 * Get a retail price based on the Printful price with markup
 * @param printfulPrice - Base price from Printful
 * @returns number - Retail price with markup
 */
function calculateRetailPrice(printfulPrice: number): number {
  // Add a 40% markup to the Printful price
  const markup = 1.4;
  return parseFloat((printfulPrice * markup).toFixed(2));
}

/**
 * Synchronizes a single Printful sync product with our local database
 * @param syncProduct - Product data from Printful sync API
 */
export async function syncPrintfulProduct(syncProduct: any): Promise<void> {
  try {
    console.log(`Syncing Printful product: ${syncProduct.name} (ID: ${syncProduct.id})`);
    
    // Get detailed product information from Printful API
    let detailedProduct;
    try {
      const detailResponse = await printfulService.getSyncProduct(syncProduct.id);
      detailedProduct = detailResponse.result;
      console.log(`Retrieved detailed product data for ${syncProduct.name}`);
    } catch (error) {
      console.warn(`Could not get detailed product data for ${syncProduct.name}, using basic data:`, error);
      detailedProduct = null;
    }
    
    // Check if product already exists in our database by printProviderId
    const existingProducts = await storage.getProductsByProviderId(syncProduct.id.toString());
    
    // Use detailed product data if available, otherwise fall back to basic sync data
    let productVariants = [];
    let productData: any = {};
    
    if (detailedProduct && detailedProduct.sync_variants && detailedProduct.sync_variants.length > 0) {
      // Use detailed variant data with proper pricing
      console.log(`Using detailed variant data with ${detailedProduct.sync_variants.length} variants`);
      const firstVariant = detailedProduct.sync_variants[0];
      
      productData = {
        name: detailedProduct.sync_product.name,
        description: detailedProduct.sync_product.name + ' - Barefoot Bay merchandise',
        price: firstVariant.retail_price, // Use the actual Printful retail price directly
        category: mapPrintfulTypeToCategory(detailedProduct.sync_product.name), // Use product name for better categorization
        imageUrls: [detailedProduct.sync_product.thumbnail_url || syncProduct.thumbnail_url],
        status: ProductStatus.ACTIVE,
        printProviderId: syncProduct.id.toString(),
        printProvider: PrintProvider.PRINTFUL,
        designUrls: [],
        mockupUrls: [],
        variantData: {
          sync_product_id: syncProduct.id,
          external_id: detailedProduct.sync_product.external_id || syncProduct.id.toString(),
          variants: detailedProduct.sync_variants.map((v: any) => ({
            id: v.id || 0,
            product_id: v.product && v.product.product_id ? v.product.product_id : 0,
            name: v.name || detailedProduct.sync_product.name,
            price: parseFloat(v.retail_price), // Use retail price directly as float
            sku: v.sku || `PF-${syncProduct.id}-${v.variant_id}`,
            sync_variant_id: v.id,
            in_stock: true, // Assume in stock unless Printful says otherwise
            // Create options array that frontend expects
            options: [
              { type: "Size", value: v.size || 'One Size' },
              { type: "Color", value: v.color || 'Default' }
            ].filter(opt => opt.value && opt.value !== 'Default' && opt.value !== 'One Size')
          }))
        }
      };
    } else {
      // Fallback to basic sync data if detailed data is not available
      console.warn(`Using fallback data for ${syncProduct.name} - detailed variants not available`);
      
      productData = {
        name: syncProduct.name,
        description: syncProduct.description || `${syncProduct.name} - Barefoot Bay merchandise`,
        price: "19.99", // Default fallback price
        category: mapPrintfulTypeToCategory(syncProduct.name), // Use product name for categorization
        imageUrls: [syncProduct.thumbnail_url || 'https://cdn.printful.com/upload/product-catalog/85/852cf52aece9a5ff2f2f5fe4bb76f012_t?v=1678168023'],
        status: ProductStatus.ACTIVE,
        printProviderId: syncProduct.id.toString(),
        printProvider: PrintProvider.PRINTFUL,
        designUrls: [],
        mockupUrls: [],
        variantData: {
          sync_product_id: syncProduct.id,
          external_id: syncProduct.external_id || syncProduct.id.toString(),
          variants: [{
            id: 0,
            product_id: 0,
            name: syncProduct.name,
            price: 19.99,
            sku: `PF-${syncProduct.id}-DEFAULT`,
            sync_variant_id: 0,
            in_stock: true,
            // Create options array that frontend expects
            options: [
              { type: "Size", value: 'One Size' }
            ]
          }]
        }
      };
    }
    
    // Update existing or create new
    if (existingProducts.length > 0) {
      // Update the existing product
      const existingProduct = existingProducts[0];
      console.log(`Updating existing product ${existingProduct.id}`);
      
      await storage.updateProduct(existingProduct.id, {
        ...productData,
        // Preserve any custom imageUrls if they exist
        imageUrls: existingProduct.imageUrls && existingProduct.imageUrls.length > 0 ? 
          existingProduct.imageUrls : productData.imageUrls
      });
    } else {
      // Create a new product
      console.log(`Creating new product: ${productData.name}`);
      await storage.createProduct(productData);
    }
    
    console.log(`Successfully synced product: ${syncProduct.name}`);
  } catch (error) {
    console.error(`Error syncing product ${syncProduct.name}:`, error);
    throw error;
  }
}

/**
 * Synchronizes all Printful products with our local database
 */
export async function syncAllPrintfulProducts(): Promise<number> {
  try {
    console.log('Starting full Printful product sync...');
    
    // Get all sync products from Printful
    const response = await printfulService.syncProducts();
    
    if (!response || !response.result) {
      console.error('No products returned from Printful sync API');
      return 0;
    }
    
    const syncProducts = response.result;
    console.log(`Found ${syncProducts.length} products to sync from Printful`);
    
    // Process each product
    let syncedCount = 0;
    for (const product of syncProducts) {
      try {
        await syncPrintfulProduct(product);
        syncedCount++;
      } catch (error) {
        console.error(`Error syncing product ${product.name}:`, error);
        // Continue with other products even if one fails
      }
    }
    
    console.log(`Completed Printful sync. Successfully synced ${syncedCount} products.`);
    return syncedCount;
  } catch (error) {
    console.error('Error in full Printful product sync:', error);
    throw error;
  }
}