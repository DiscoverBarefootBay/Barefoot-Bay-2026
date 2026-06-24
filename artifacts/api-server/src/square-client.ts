/**
 * Square payment client for handling payments and subscriptions
 * 
 * This module provides a wrapper around the Square API for our application,
 * handling customer management, payments, and subscriptions.
 */
// Use default import for Square as it's a CommonJS module
import Square from 'square';

// The SDK structure might vary, so let's handle different export formats
let Client, Environment;

if (Square.default) {
  // If Square has a default export with the actual classes
  const { Client: ClientClass, Environment: EnvironmentEnum } = Square.default;
  Client = ClientClass;
  Environment = EnvironmentEnum;
} else if (Square.SquareClient && Square.SquareEnvironment) {
  // If Square exports the classes directly
  Client = Square.SquareClient;
  Environment = Square.SquareEnvironment;
} else {
  // Fallback to direct usage if available
  Client = Square.Client || Square;
  Environment = {
    Production: 'production',
    Sandbox: 'sandbox'
  };
}

// Map of subscription plan IDs to their details
export enum SubscriptionPlans {
  MONTHLY = 'monthly_membership',
  ANNUAL = 'annual_membership'
}

// Plan details mapping
export interface SubscriptionPlanDetails {
  name: string;
  amount: number;
  interval: 'MONTHLY' | 'ANNUAL';
  currency: string;
}

// Map plan IDs to their details
const PLAN_DETAILS: Record<string, SubscriptionPlanDetails> = {
  [SubscriptionPlans.MONTHLY]: {
    name: 'Monthly Membership',
    amount: 500, // $5.00
    interval: 'MONTHLY',
    currency: 'USD'
  },
  [SubscriptionPlans.ANNUAL]: {
    name: 'Annual Membership',
    amount: 5000, // $50.00
    interval: 'ANNUAL',
    currency: 'USD'
  }
};

// Square client singleton
let squareClientInstance: any = null;

// Import the getSquareCredentials function from square-service
import { getSquareCredentials } from './square-service';

// Create Square client with API key from environment
export function getSquareClient() {
  // Always reset the client to ensure fresh credentials
  squareClientInstance = null;

  console.log('GETTING SQUARE CLIENT - ENSURING FRESH INSTANCE');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Process ID: ${process.pid}`);

  // Get fresh credentials
  const { accessToken, applicationId, locationId } = getSquareCredentials();

  console.log('Initializing Square client with:');
  console.log(`- SQUARE_ACCESS_TOKEN: ${accessToken ? 'Present (masked)' : 'Missing'}`);
  console.log(`- SQUARE_APPLICATION_ID: ${applicationId ? 'Present (masked)' : 'Missing'}`);
  console.log(`- SQUARE_LOCATION_ID: ${locationId ? 'Present (masked)' : 'Missing'}`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);

  // Use sandbox environment for development/testing
  const env = process.env.NODE_ENV === 'production' 
    ? Environment.Production 
    : Environment.Sandbox;

  if (!accessToken) {
    // In production, we should fail if no Square access token
    if (process.env.NODE_ENV === 'production') {
      console.error('SQUARE_ACCESS_TOKEN not found in production environment');
      throw new Error('Square API access token is required in production');
    }
    
    // Only in development we allow mock client
    console.log('SQUARE_ACCESS_TOKEN not found in development, creating mock Square client');
    squareClientInstance = createMockClient();
    return squareClientInstance;
  }

  // Additional Square client initialization logging
  console.log('Square SDK type:', typeof Client);
  console.log('Square SDK keys:', Object.keys(Client));
  console.log('Square has default export:', Client.default ? 'object' : 'none');
  
  if (Client.default) {
    console.log('Default export keys:', Object.keys(Client.default));
  }

  try {
    console.log('Attempting to create Square client...');
    
    let squareClient;
    
    try {
      // First try with Square.default (typical structure)
      if (Square.default && Square.default.SquareClient) {
        console.log('Initializing Square with Square.default.SquareClient');
        const SquareClient = Square.default.SquareClient;
        squareClient = new SquareClient({
          accessToken: accessToken, // Use fresh credentials
          environment: env
        });
      } 
      // Try with direct Square property
      else if (Square.SquareClient) {
        console.log('Initializing Square with Square.SquareClient');
        const SquareClient = Square.SquareClient;
        squareClient = new SquareClient({
          accessToken: accessToken, // Use fresh credentials
          environment: env
        });
      }
      // Try with the Client variable (set earlier)
      else {
        console.log('Initializing Square with Client constructor');
        squareClient = new Client({
          accessToken: accessToken, // Use fresh credentials
          environment: env
        });
      }
      
      // Check if client was created and has necessary APIs
      if (!squareClient) {
        throw new Error('Failed to initialize Square client - client is undefined');
      }
      
      // Manual approach - if we didn't get the expected object structure
      if (!squareClient.customersApi) {
        console.log('Trying manual client construction');
        
        // Try to manually construct the client
        const manualClient = {
          customersApi: {
            createCustomer: async (customerData) => {
              // Use fetch to directly call Square API with fresh credentials
              const { accessToken } = getSquareCredentials();
              const response = await fetch(`https://connect.squareup.com/v2/customers`, {
                method: 'POST',
                headers: {
                  'Square-Version': '2023-10-16',
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(customerData)
              });
              
              if (!response.ok) {
                throw new Error(`Square API error: ${response.status} ${response.statusText}`);
              }
              
              return response.json();
            }
          },
          subscriptionsApi: {
            createSubscription: async (subscriptionData) => {
              // Use fresh credentials
              const { accessToken } = getSquareCredentials();
              const response = await fetch(`https://connect.squareup.com/v2/subscriptions`, {
                method: 'POST',
                headers: {
                  'Square-Version': '2023-10-16',
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscriptionData)
              });
              
              if (!response.ok) {
                throw new Error(`Square API error: ${response.status} ${response.statusText}`);
              }
              
              return response.json();
            },
            retrieveSubscription: async (subscriptionId) => {
              // Use fresh credentials
              const { accessToken } = getSquareCredentials();
              const response = await fetch(`https://connect.squareup.com/v2/subscriptions/${subscriptionId}`, {
                method: 'GET',
                headers: {
                  'Square-Version': '2023-10-16',
                  'Authorization': `Bearer ${accessToken}`
                }
              });
              
              if (!response.ok) {
                throw new Error(`Square API error: ${response.status} ${response.statusText}`);
              }
              
              return response.json();
            },
            cancelSubscription: async (subscriptionId) => {
              // Use fresh credentials
              const { accessToken } = getSquareCredentials();
              const response = await fetch(`https://connect.squareup.com/v2/subscriptions/${subscriptionId}/cancel`, {
                method: 'POST',
                headers: {
                  'Square-Version': '2023-10-16',
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
              });
              
              if (!response.ok) {
                throw new Error(`Square API error: ${response.status} ${response.statusText}`);
              }
              
              return response.json();
            }
          },
          checkoutApi: squareClient.checkoutApi,
          locationsApi: squareClient.locationsApi,
          ordersApi: squareClient.ordersApi,
          paymentsApi: squareClient.paymentsApi || null
        };
        
        console.log('Created manual Square client implementation');
        squareClient = manualClient;
      }
      
      // If we still don't have the necessary APIs in production
      if (process.env.NODE_ENV === 'production' && (!squareClient.customersApi || !squareClient.subscriptionsApi)) {
        console.error('Square client initialized but necessary APIs not available in production environment');
        throw new Error('Square API access incomplete - required APIs not available in production');
      }
      
      // In development, fall back to mock if needed
      if (process.env.NODE_ENV !== 'production' && (!squareClient.customersApi || !squareClient.subscriptionsApi)) {
        console.log('Square client initialized but APIs not available in development, using mock implementation');
        squareClient = createMockClient();
      }
    } catch (error) {
      // In production, we should fail if we can't initialize the Square client
      if (process.env.NODE_ENV === 'production') {
        console.error('Failed to initialize Square client in production:', error);
        throw new Error('Could not initialize Square client in production');
      }
      
      // Only in development we allow mock client after errors
      console.error('Failed to initialize real Square client in development, using mock implementation', error);
      squareClient = createMockClient();
    }

    // Create extended client with our additional methods
    squareClientInstance = {
      ...squareClient,
      
      // Customer management
      async createCustomer(userId: number, email: string, name?: string) {
        console.log(`Creating Square customer for user ${userId} with email ${email}`);
        
        try {
          // Check if customersApi is available
          if (!squareClient.customersApi) {
            // In production, we should fail if the customersApi is not available
            if (process.env.NODE_ENV === 'production') {
              console.error('Square customersApi not available in production environment');
              throw new Error('Square customers API not available in production');
            }
            
            // Only in development we allow mock customer creation
            console.log('Square customersApi not available in development, using mock customer creation');
            return {
              id: `mock_customer_${Date.now()}`,
              email,
              name: name || 'Mock Customer'
            };
          }
          
          const response = await squareClient.customersApi.createCustomer({
            emailAddress: email,
            givenName: name || 'Member',
            referenceId: userId.toString()
          });
          
          return response.result.customer;
        } catch (error) {
          console.error('Error creating Square customer:', error);
          
          // In production, we should fail if we can't create a Square customer
          if (process.env.NODE_ENV === 'production') {
            console.error('Failed to create Square customer in production environment');
            throw new Error('Failed to create Square customer in production: ' + error.message);
          }
          
          // Only in development we allow mock customer after errors
          console.log('Falling back to mock customer creation due to error in development');
          return {
            id: `mock_customer_${Date.now()}`,
            email,
            name: name || 'Mock Customer'
          };
        }
      },
      
      // Subscription management
      async createSubscription(customerId: string, planId: SubscriptionPlans) {
        console.log(`Creating Square subscription for customer ${customerId} with plan ${planId}`);
        
        try {
          const planDetails = PLAN_DETAILS[planId];
          if (!planDetails) {
            throw new Error(`Unknown subscription plan: ${planId}`);
          }
          
          // Check if subscriptionsApi is available
          if (!squareClient.subscriptionsApi) {
            // In production, we should fail if the subscriptionsApi is not available
            if (process.env.NODE_ENV === 'production') {
              console.error('Square subscriptionsApi not available in production environment');
              throw new Error('Square subscriptions API not available in production');
            }
            
            // Only in development we allow mock subscription creation
            console.log('Square subscriptionsApi not available in development, using mock subscription creation');
            return {
              id: `mock_subscription_${Date.now()}`,
              customerId,
              planId,
              status: 'ACTIVE',
              startDate: new Date().toISOString(),
              planDetails
            };
          }
          
          // Always get fresh credentials to ensure we use the current locationId
          const { locationId } = getSquareCredentials();
          console.log(`Using fresh locationId for subscription: ${locationId}`);
          
          const response = await squareClient.subscriptionsApi.createSubscription({
            locationId: locationId!, // Force non-null
            customerId: customerId,
            planId: planId,
            startDate: new Date().toISOString(),
            cardId: null, // Customer will provide card details through checkout
          });
          
          return response.result.subscription;
        } catch (error) {
          console.error('Error creating Square subscription:', error);
          
          // In production, we should fail if we can't create a subscription
          if (process.env.NODE_ENV === 'production') {
            console.error('Failed to create Square subscription in production environment');
            throw new Error('Failed to create Square subscription in production: ' + error.message);
          }
          
          // Only in development we allow mock subscription after errors
          console.log('Falling back to mock subscription creation due to error in development');
          return {
            id: `mock_subscription_${Date.now()}`,
            customerId,
            planId,
            status: 'ACTIVE',
            startDate: new Date().toISOString(),
            planDetails: PLAN_DETAILS[planId]
          };
        }
      },
      
      async getSubscription(subscriptionId: string) {
        console.log(`Retrieving Square subscription ${subscriptionId}`);
        
        // Check if this is a mock subscription ID or local subscription
        const isMockSubscription = subscriptionId.startsWith('mock_');
        const isLocalSubscription = subscriptionId.startsWith('local_subscription');
        
        if (isMockSubscription || isLocalSubscription) {
          console.log(`Detected ${isMockSubscription ? 'mock' : 'local'} subscription ID: ${subscriptionId}, returning mock data`);
          return {
            id: subscriptionId,
            status: 'ACTIVE',
            startDate: new Date(Date.now() - 86400000).toISOString() // Yesterday
          };
        }
        
        try {
          // Check if subscriptionsApi is available
          if (!squareClient.subscriptionsApi) {
            // In production, we should fail if the subscriptionsApi is not available
            if (process.env.NODE_ENV === 'production') {
              console.error('Square subscriptionsApi not available in production environment');
              throw new Error('Square subscriptions API not available in production');
            }
            
            // Only in development we allow mock subscription retrieval
            console.log('Square subscriptionsApi not available in development, using mock for retrieving subscription');
            return {
              id: subscriptionId,
              status: 'ACTIVE',
              startDate: new Date(Date.now() - 86400000).toISOString() // Yesterday
            };
          }
          
          const response = await squareClient.subscriptionsApi.retrieveSubscription(subscriptionId);
          return response.result.subscription;
        } catch (error) {
          console.error('Error retrieving Square subscription:', error);
          
          // In production, we should fail if we can't retrieve a subscription
          if (process.env.NODE_ENV === 'production') {
            console.error('Failed to retrieve Square subscription in production environment');
            throw new Error('Failed to retrieve Square subscription in production: ' + error.message);
          }
          
          // Only in development we allow mock subscription data after errors
          console.log('Falling back to mock subscription data due to error in development');
          return {
            id: subscriptionId,
            status: 'ACTIVE',
            startDate: new Date(Date.now() - 86400000).toISOString() // Yesterday
          };
        }
      },
      
      async cancelSubscription(subscriptionId: string) {
        console.log(`Cancelling Square subscription ${subscriptionId}`);
        
        // Check if this is a mock subscription ID or local subscription
        const isMockSubscription = subscriptionId.startsWith('mock_');
        const isLocalSubscription = subscriptionId.startsWith('local_subscription');
        
        if (isMockSubscription || isLocalSubscription) {
          console.log(`Detected ${isMockSubscription ? 'mock' : 'local'} subscription ID: ${subscriptionId}, returning mock canceled data`);
          return {
            id: subscriptionId,
            status: 'CANCELED'
          };
        }
        
        try {
          // Check if subscriptionsApi is available
          if (!squareClient.subscriptionsApi) {
            // In production, we should fail if the subscriptionsApi is not available
            if (process.env.NODE_ENV === 'production') {
              console.error('Square subscriptionsApi not available in production environment');
              throw new Error('Square subscriptions API not available in production');
            }
            
            // Only in development we allow mock subscription cancellation
            console.log('Square subscriptionsApi not available in development, using mock for cancelling subscription');
            return {
              id: subscriptionId,
              status: 'CANCELED'
            };
          }
          
          const response = await squareClient.subscriptionsApi.cancelSubscription(subscriptionId);
          return response.result.subscription;
        } catch (error) {
          console.error('Error cancelling Square subscription:', error);
          
          // In production, we should fail if we can't cancel a subscription
          if (process.env.NODE_ENV === 'production') {
            console.error('Failed to cancel Square subscription in production environment');
            throw new Error('Failed to cancel Square subscription in production: ' + error.message);
          }
          
          // Only in development we allow mock canceled subscription data after errors
          console.log('Falling back to mock canceled subscription due to error in development');
          return {
            id: subscriptionId,
            status: 'CANCELED'
          };
        }
      },
      
      // Payment management
      async retrievePayment(paymentId: string) {
        console.log(`Retrieving Square payment ${paymentId}`);
        
        try {
          // Check if paymentsApi is available
          if (!squareClient.paymentsApi) {
            // In production, we should fail if the paymentsApi is not available
            if (process.env.NODE_ENV === 'production') {
              console.error('Square paymentsApi not available in production environment');
              throw new Error('Square payments API not available in production');
            }
            
            // Only in development we allow mock payment retrieval
            console.log('Square paymentsApi not available in development, using mock for retrieving payment');
            return {
              id: paymentId,
              status: 'COMPLETED',
              amountMoney: {
                amount: 500,
                currency: 'USD'
              },
              note: 'User ID: 1, Plan: monthly'
            };
          }
          
          const response = await squareClient.paymentsApi.getPayment(paymentId);
          return response.result.payment;
        } catch (error) {
          console.error('Error retrieving Square payment:', error);
          
          // In production, we should fail if we can't retrieve a payment
          if (process.env.NODE_ENV === 'production') {
            console.error('Failed to retrieve Square payment in production environment');
            throw new Error('Failed to retrieve Square payment in production: ' + error.message);
          }
          
          // Only in development we allow mock payment data after errors
          console.log('Falling back to mock payment data due to error in development');
          return {
            id: paymentId,
            status: 'COMPLETED',
            amountMoney: {
              amount: 500,
              currency: 'USD'
            },
            note: 'User ID: 1, Plan: monthly'
          };
        }
      }
    };
    
    console.log('Square client successfully initialized.');
    console.log('Square client API availability:');
    
    // Log which APIs are available (allows us to debug more easily)
    const apis = [
      'checkoutApi', 
      'locationsApi', 
      'ordersApi', 
      'customersApi',
      'subscriptionsApi',
      'paymentsApi'
    ];
    
    for (const api of apis) {
      console.log(`- ${api}: ${Boolean(squareClientInstance[api])}`);
    }
    
    return squareClientInstance;
  } catch (error) {
    // In production, we should fail if we can't initialize the Square client
    if (process.env.NODE_ENV === 'production') {
      console.error('Failed to initialize Square client in production:', error);
      throw new Error('Could not initialize Square client in production');
    }
    
    // Only in development we allow mock client after errors
    console.error('Failed to initialize Square client in development, falling back to mock implementation:', error);
    squareClientInstance = createMockClient();
    return squareClientInstance;
  }
}

// Create a mock client for local development/testing
function createMockClient() {
  console.log('Creating mock Square client for development/testing');
  
  // Mock client with API methods that work for local testing
  const mockClient = {
    checkoutApi: {
      createPaymentLink: async ({ idempotencyKey, quickPay, note, redirectUrl }: any) => {
        console.log('MOCK: Creating payment link with:', { idempotencyKey, quickPay, note, redirectUrl });
        
        // The localhost path cannot actually be used for Square payments,
        // but this allows testing the redirect flow locally
        return {
          result: {
            paymentLink: {
              id: `mock_payment_${Date.now()}`,
              url: `${redirectUrl}&status=success`
            }
          }
        };
      }
    },
    
    locationsApi: {
      listLocations: async () => {
        return {
          result: {
            locations: [
              {
                id: 'MOCK_LOCATION',
                name: 'Mock Location',
                status: 'ACTIVE'
              }
            ]
          }
        };
      }
    },
    
    ordersApi: {
      createOrder: async (order: any) => {
        console.log('MOCK: Creating order:', order);
        return {
          result: {
            order: {
              id: `mock_order_${Date.now()}`,
              locationId: 'MOCK_LOCATION',
              lineItems: order.order.lineItems,
              total: order.order.lineItems.reduce((sum: number, item: any) => 
                sum + parseInt(item.basePriceMoney.amount) * parseInt(item.quantity), 0)
            }
          }
        };
      },
      
      retrieveOrder: async (orderId: string) => {
        console.log('MOCK: Retrieving order:', orderId);
        return {
          result: {
            order: {
              id: orderId,
              locationId: 'MOCK_LOCATION',
              state: 'COMPLETED',
              customerId: `mock_customer_${Date.now()}`,
              customerEmail: 'mock@example.com',
              lineItems: [
                {
                  name: 'Monthly Membership',
                  note: 'membership',
                  basePriceMoney: {
                    amount: 500,
                    currency: 'USD'
                  },
                  quantity: '1'
                }
              ]
            }
          }
        };
      },
      
      searchOrders: async (searchQuery: any) => {
        console.log('MOCK: Searching orders:', searchQuery);
        return {
          result: {
            orders: [] // Return empty array for mock searches
          }
        };
      }
    },
    
    customersApi: {
      createCustomer: async (customer: any) => {
        console.log('MOCK: Creating customer:', customer);
        return {
          result: {
            customer: {
              id: `mock_customer_${Date.now()}`,
              emailAddress: customer.emailAddress,
              givenName: customer.givenName,
              referenceId: customer.referenceId
            }
          }
        };
      }
    },
    
    subscriptionsApi: {
      createSubscription: async (subscription: any) => {
        console.log('MOCK: Creating subscription:', subscription);
        // Use fresh credentials for locationId
        const { locationId } = getSquareCredentials();
        return {
          result: {
            subscription: {
              id: `mock_subscription_${Date.now()}`,
              locationId: locationId || subscription.locationId,
              customerId: subscription.customerId,
              planId: subscription.planId,
              startDate: subscription.startDate,
              status: 'ACTIVE'
            }
          }
        };
      },
      
      retrieveSubscription: async (subscriptionId: string) => {
        console.log('MOCK: Retrieving subscription:', subscriptionId);
        return {
          result: {
            subscription: {
              id: subscriptionId,
              status: 'ACTIVE'
            }
          }
        };
      },
      
      cancelSubscription: async (subscriptionId: string) => {
        console.log('MOCK: Cancelling subscription:', subscriptionId);
        return {
          result: {
            subscription: {
              id: subscriptionId,
              status: 'CANCELED'
            }
          }
        };
      }
    },
    
    paymentsApi: {
      getPayment: async (paymentId: string) => {
        console.log('MOCK: Retrieving payment:', paymentId);
        return {
          result: {
            payment: {
              id: paymentId,
              status: 'COMPLETED',
              amountMoney: {
                amount: 500,
                currency: 'USD'
              },
              note: 'User ID: 1, Plan: monthly'
            }
          }
        };
      }
    },
    
    // Our custom methods
    createCustomer: async (userId: number, email: string, name?: string) => {
      console.log('MOCK: Creating customer via custom method:', { userId, email, name });
      return {
        id: `mock_customer_${Date.now()}`,
        email,
        name: name || 'Mock Customer'
      };
    },
    
    createSubscription: async (customerId: string, planId: SubscriptionPlans) => {
      console.log('MOCK: Creating subscription via custom method:', { customerId, planId });
      const planDetails = PLAN_DETAILS[planId];
      // Use fresh credentials for locationId
      const { locationId } = getSquareCredentials();
      return {
        id: `mock_subscription_${Date.now()}`,
        locationId,
        customerId,
        planId,
        status: 'ACTIVE',
        startDate: new Date().toISOString(),
        planDetails
      };
    },
    
    getSubscription: async (subscriptionId: string) => {
      console.log('MOCK: Getting subscription via custom method:', subscriptionId);
      return {
        id: subscriptionId,
        status: 'ACTIVE',
        startDate: new Date(Date.now() - 86400000).toISOString() // Yesterday
      };
    },
    
    cancelSubscription: async (subscriptionId: string) => {
      console.log('MOCK: Cancelling subscription via custom method:', subscriptionId);
      return {
        id: subscriptionId,
        status: 'CANCELED'
      };
    },
    
    retrievePayment: async (paymentId: string) => {
      console.log('MOCK: Retrieving payment via custom method:', paymentId);
      return {
        id: paymentId,
        status: 'COMPLETED',
        amount: 500,
        currency: 'USD',
        note: 'User ID: 1, Plan: monthly'
      };
    }
  };
  
  console.log('Square client successfully initialized.');
  console.log('Square client API availability:');
  const apis = [
    'checkoutApi', 
    'locationsApi', 
    'ordersApi', 
    'customersApi',
    'subscriptionsApi',
    'paymentsApi'
  ];
  
  for (const api of apis) {
    console.log(`- ${api}: ${Boolean(mockClient[api])}`);
  }
  
  return mockClient;
}