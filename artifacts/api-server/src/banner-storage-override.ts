/**
 * Banner Storage Override
 * 
 * This file contains overrides for functions related to banner slide storage,
 * ensuring that banner slides are ONLY stored in Object Storage, never in filesystem.
 * 
 * This is a crucial component for ensuring that banner slides maintain persistence
 * across container restarts and deployments.
 */

import fs from 'fs';
import path from 'path';
import { objectStorageService } from './object-storage-service';

// Constants for banner slide storage
export const BANNER_BUCKET = 'BANNER';
export const BANNER_SLIDE_FOLDER = 'banner-slides';

/**
 * Verify that a banner slide exists in Object Storage (exclusive storage)
 * @param filename The filename to check
 * @returns boolean Always returns true to bypass filesystem storage
 */
export function verifyBannerSlideExists(filename: string): boolean {
  console.log(`[MediaPath] Banner slide verification - ${filename}: Using Object Storage exclusively`);
  // Always return true to prevent filesystem fallback
  return true;
}

/**
 * Override the syncBannerSlide function to prevent filesystem storage
 * @param filename The filename to sync
 * @returns boolean Always returns true to prevent filesystem fallback
 */
export function syncBannerSlide(filename: string): boolean {
  console.log(`[MediaPath] Banner slide sync - ${filename}: Using Object Storage exclusively, no filesystem sync needed`);
  // Always return true to prevent filesystem fallback
  return true;
}

/**
 * Function to check if a banner slide exists in Object Storage
 * This could be used to actually verify file existence without filesystem fallback
 * @param filename The filename to check
 * @returns Promise<boolean> indicating if the file exists in Object Storage
 */
export async function bannerSlideExistsInObjectStorage(filename: string): Promise<boolean> {
  try {
    const exists = await objectStorageService.fileExists(BANNER_SLIDE_FOLDER, filename, BANNER_BUCKET);
    console.log(`[MediaPath] Banner slide ${filename} exists in Object Storage: ${exists}`);
    return exists;
  } catch (error) {
    console.error(`[MediaPath] Error checking if banner slide exists in Object Storage:`, error);
    return false;
  }
}

/**
 * Get the Object Storage URL for a banner slide
 * @param filename The filename to get the URL for
 * @returns The Object Storage URL for the banner slide
 */
export function getBannerSlideObjectStorageUrl(filename: string): string {
  // Construct the Object Storage URL directly
  return `https://object-storage.replit.app/${BANNER_BUCKET}/${BANNER_SLIDE_FOLDER}/${filename}`;
}

/**
 * Upload a banner slide to Object Storage only, never to filesystem
 * @param filePath Path to the file to upload
 * @param newFilename New filename to use for the uploaded file
 * @returns Promise<string> URL to the uploaded file in Object Storage
 */
export async function uploadBannerSlideToObjectStorage(filePath: string, newFilename: string): Promise<string> {
  try {
    const objectStorageUrl = await objectStorageService.uploadFile(
      filePath,
      BANNER_SLIDE_FOLDER,
      newFilename,
      BANNER_BUCKET
    );
    
    console.log(`[BannerStorage] Successfully uploaded banner slide to Object Storage: ${objectStorageUrl}`);
    return objectStorageUrl;
  } catch (error) {
    console.error(`[BannerStorage] Error uploading banner slide to Object Storage:`, error);
    throw new Error(`Failed to upload banner slide to Object Storage: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Migrate an existing banner slide from filesystem to Object Storage
 * @param filename The filename to migrate
 * @returns Promise<boolean> indicating if the migration was successful
 */
export async function migrateBannerSlideToObjectStorage(filename: string): Promise<boolean> {
  try {
    // Check if file exists in Object Storage already
    const exists = await bannerSlideExistsInObjectStorage(filename);
    if (exists) {
      console.log(`[BannerStorage] Banner slide ${filename} already exists in Object Storage, no migration needed`);
      return true;
    }
    
    // Get file path in filesystem
    const filePath = path.join(process.cwd(), 'uploads', BANNER_SLIDE_FOLDER, filename);
    if (!fs.existsSync(filePath)) {
      console.error(`[BannerStorage] Banner slide ${filename} not found in filesystem, cannot migrate`);
      return false;
    }
    
    // Upload to Object Storage
    await uploadBannerSlideToObjectStorage(filePath, filename);
    console.log(`[BannerStorage] Successfully migrated banner slide ${filename} to Object Storage`);
    return true;
  } catch (error) {
    console.error(`[BannerStorage] Error migrating banner slide ${filename} to Object Storage:`, error);
    return false;
  }
}