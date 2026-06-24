# Deployment Configuration for Barefoot Bay

This document outlines the specific configuration needed for deploying the Barefoot Bay community portal to production.

## Deployment Steps

1. When deploying through Replit, you need to make the following changes to the .replit file:

```
# .replit
run = "./deploy.sh"

[deployment]
run = ["sh", "-c", "NODE_ENV=production PORT=5000 node dist/index.js"]
```

2. The deployment configuration will:
   - Set the correct PORT environment variable (5000)
   - Set NODE_ENV to production
   - Use the server configuration that's already defined in server/index.ts

## Port Configuration

The server is configured to use port 5000 in the Replit production environment:

```typescript
// From server/index.ts
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
```

## Important Notes

1. These changes are ONLY needed for deployment.
2. Do not modify your development setup or workflow.
3. The deploy.sh script handles the entire deployment process.
4. Your normal development workflow is not affected by these changes.

## Troubleshooting

If deployment fails:
1. Check that the port configuration in server/index.ts matches what's in the .replit file (PORT=5000)
2. Verify that NODE_ENV is set to "production" in the deployment command
3. Make sure no other processes are using port 5000 in the Replit environment