/**
 * Square Application Information Service
 * 
 * This service provides diagnostic information about the Square integration
 * to help troubleshoot credential and configuration issues.
 */

import { Router } from 'express';
import { getSquareCredentials, getSquareClientStatus } from './square-service';
import { getDirectSquareCredentials } from './direct-square-service';

const router = Router();

/**
 * GET /api/square-app-info
 * Returns diagnostic information about Square integration status
 */
router.get('/', async (req, res) => {
  try {
    console.log('Square app info request received');
    
    // Get credentials from both services
    const squareServiceCreds = getSquareCredentials();
    const directSquareCreds = getDirectSquareCredentials();
    const clientStatus = getSquareClientStatus();
    
    // Get environment variables directly
    const envVars = {
      SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
      SQUARE_APPLICATION_ID: process.env.SQUARE_APPLICATION_ID,
      SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
      NODE_ENV: process.env.NODE_ENV
    };
    
    // Log for debugging
    console.log('Environment variables check:');
    console.log('SQUARE_ACCESS_TOKEN:', envVars.SQUARE_ACCESS_TOKEN ? 'Present' : 'Missing');
    console.log('SQUARE_APPLICATION_ID:', envVars.SQUARE_APPLICATION_ID ? 'Present' : 'Missing');
    console.log('SQUARE_LOCATION_ID:', envVars.SQUARE_LOCATION_ID ? 'Present' : 'Missing');
    console.log('NODE_ENV:', envVars.NODE_ENV);
    
    const response = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      
      // Masked credentials for security
      squareServiceCredentials: {
        accessToken: squareServiceCreds.accessToken ? 
          `${squareServiceCreds.accessToken.substring(0, 8)}...${squareServiceCreds.accessToken.substring(squareServiceCreds.accessToken.length - 4)}` : 
          'Missing',
        applicationId: squareServiceCreds.applicationId || 'Missing',
        locationId: squareServiceCreds.locationId || 'Missing'
      },
      
      directSquareCredentials: {
        accessToken: directSquareCreds.accessToken ? 
          `${directSquareCreds.accessToken.substring(0, 8)}...${directSquareCreds.accessToken.substring(directSquareCreds.accessToken.length - 4)}` : 
          'Missing',
        applicationId: directSquareCreds.applicationId || 'Missing',
        locationId: directSquareCreds.locationId || 'Missing'
      },
      
      clientStatus: clientStatus,
      
      // Environment variable presence (without exposing values)
      environmentVariables: {
        SQUARE_ACCESS_TOKEN: !!envVars.SQUARE_ACCESS_TOKEN,
        SQUARE_APPLICATION_ID: !!envVars.SQUARE_APPLICATION_ID,
        SQUARE_LOCATION_ID: !!envVars.SQUARE_LOCATION_ID,
        NODE_ENV: envVars.NODE_ENV || 'not set'
      },
      
      // Expected production credentials (partial for verification)
      expectedProductionCredentials: {
        accessTokenPrefix: 'EAAAl',
        applicationIdExpected: 'sq0idp--SA_vpoayqlHPdx0mklBpA',
        locationIdExpected: 'LPFXX5FDRV0E8'
      }
    };
    
    res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Error getting Square app info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/square-app-info/refresh-credentials
 * Forces a refresh of Square credentials and client initialization
 */
router.post('/refresh-credentials', async (req, res) => {
  try {
    console.log('Square credentials refresh requested');
    
    // Clear any cached Square client instances
    delete require.cache[require.resolve('./square-client')];
    delete require.cache[require.resolve('./square-service')];
    delete require.cache[require.resolve('./direct-square-service')];
    
    // Force re-import to get fresh credentials
    const { getSquareClient } = require('./square-client');
    const { getSquareCredentials: getRefreshedCreds } = require('./square-service');
    
    // Get fresh credentials
    const refreshedCreds = getRefreshedCreds();
    
    console.log('Refreshed credentials:');
    console.log('Access Token:', refreshedCreds.accessToken ? 'Present' : 'Missing');
    console.log('Application ID:', refreshedCreds.applicationId || 'Missing');
    console.log('Location ID:', refreshedCreds.locationId || 'Missing');
    
    // Try to initialize a fresh Square client
    const freshClient = getSquareClient();
    
    res.json({
      success: true,
      message: 'Square credentials refreshed successfully',
      credentials: {
        accessToken: refreshedCreds.accessToken ? 
          `${refreshedCreds.accessToken.substring(0, 8)}...${refreshedCreds.accessToken.substring(refreshedCreds.accessToken.length - 4)}` : 
          'Missing',
        applicationId: refreshedCreds.applicationId || 'Missing',
        locationId: refreshedCreds.locationId || 'Missing'
      },
      clientInitialized: !!freshClient
    });
    
  } catch (error) {
    console.error('Error refreshing Square credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;