# Printful Integration Setup Guide

This guide will help you set up a Printful store and configure it to work with the Barefoot Bay community website's online store.

## Step 1: Create a Printful Account and Store

1. Go to [Printful.com](https://www.printful.com/) and sign up for an account
2. Once logged in, click on "Stores" in the dashboard
3. Click "Add new store" and select "API integration"
4. Enter "Barefoot Bay Store" as the store name 
5. Complete the setup process

## Step 2: Get Your Store ID

1. After creating your store, go to the Stores page in your Printful dashboard
2. Click on your new "Barefoot Bay Store"
3. In the URL bar, note the store ID number. For example, if the URL is https://www.printful.com/dashboard/store/123456, your store ID is `123456`

## Step 3: Configure Your Environment Variables

1. Add the store ID to your `.env` file:
   ```
   PRINTFUL_STORE_ID=your_store_id_here
   ```
2. Make sure your PRINTFUL_API_KEY is also correctly set in the `.env` file
3. Restart your application

## Step 4: Testing Your Integration

1. Log in to your Barefoot Bay admin dashboard
2. Go to the Product Management page
3. Navigate to the "Print Service Settings" tab
4. Click "Test Connection" to verify the integration is working properly
5. If successful, you'll see "Connected to Printful" with your store information
6. Try viewing the Product Catalog to see available Printful items

## Troubleshooting

If you encounter issues with the Printful integration:

1. Verify that both `PRINTFUL_API_KEY` and `PRINTFUL_STORE_ID` are correctly set in your `.env` file
2. Check the API key in your Printful account settings to ensure it matches
3. Ensure you're using the correct store ID from your Printful dashboard
4. Check your server logs for detailed error messages

## Technical Details for Developers

The Printful integration has the following components:

1. Server-side API communication in `server/printful-service.ts`
2. API routes in `server/routes/printful.ts`
3. Frontend integration in `client/src/components/admin/printful-integration.tsx`

Most Printful API endpoints require a store_id parameter, which is now extracted from the environment variables. If you change your Printful store, you'll need to update the PRINTFUL_STORE_ID accordingly.

For more information on the Printful API, see the [official documentation](https://developers.printful.com/docs/).