# Stripe Integration Setup

This document explains how to properly configure the Stripe integration for the Barefoot Bay Community project.

## Prerequisites

1. A Stripe account - If you don't have one, you can sign up at [stripe.com](https://stripe.com)
2. API keys from your Stripe Dashboard

## Setting Up API Keys

1. Login to your Stripe Dashboard at [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Navigate to Developers > API keys
3. You will need both the Publishable key and the Secret key

## Configuration Steps

1. Open the `.env` file in the root of the project
2. Add your Stripe API keys as follows:
   ```
   VITE_STRIPE_PUBLIC_KEY=pk_test_your_publishable_key_here
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   ```
   - Replace `pk_test_your_publishable_key_here` with your Stripe publishable key
   - Replace `sk_test_your_secret_key_here` with your Stripe secret key

> **Important**: Always use test keys for development. Only use live keys in production environments after thorough testing.

## Testing the Integration

After configuring the API keys:

1. Restart the application server
2. Navigate to the Real Estate section
3. Attempt to create a new listing, which will prompt for payment
4. Use Stripe test card numbers for testing:
   - `4242 4242 4242 4242` - Successful payment
   - `4000 0000 0000 0002` - Declined payment

## Troubleshooting

If you encounter errors with the Stripe integration:

1. Verify both API keys are correctly entered in the `.env` file
2. Make sure the application has been restarted after updating the keys
3. Check the browser console and server logs for specific error messages
4. Confirm your Stripe account is properly set up and not in restricted mode

## Error Handling Improvements

The application has been updated with robust error handling for Stripe integration:

1. Proper null-checking for Stripe initialization
2. Helpful error messages when API keys are missing
3. Graceful fallbacks when Stripe services are unavailable

If you need to test with discount codes, the following are available:
- `FREE2025` - 100% discount (free listing)
- `HALF2025` - 50% discount

## Support

For further assistance with Stripe integration issues:
- Review the Stripe documentation at [https://stripe.com/docs](https://stripe.com/docs)
- Contact the development team for project-specific questions