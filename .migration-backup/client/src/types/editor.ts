/**
 * Editor Context Data
 * 
 * This type defines the context information passed to the editor components.
 * It helps the editor determine which upload endpoint to use based on section/content type.
 */

export interface EditorContextData {
  /**
   * The section of the site this content belongs to (e.g., 'vendors', 'forum', 'community')
   * Used to route uploads to the correct Object Storage bucket
   */
  section: string;
  
  /**
   * The slug of the content being edited
   * Provides additional context for the upload process
   */
  slug?: string;
  
  /**
   * Any additional metadata needed for specialized upload handling
   */
  [key: string]: any;
}