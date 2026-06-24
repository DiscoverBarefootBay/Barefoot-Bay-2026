# Avatar Path Management

## Overview

This document outlines the implementation of avatar image handling in the Barefoot Bay community platform. The system supports both production and development image paths, ensuring consistent avatar display across all environments.

## Implementation Details

### 1. Directory Structure

Avatar images are stored in two locations:
- `/avatars/` - Production path
- `/uploads/avatars/` - Development path

When a user uploads an avatar, the file is saved to both locations to ensure it can be accessed from either path.

### 2. Static Routes Configuration

Both paths are configured as static routes in `server/index.ts`:

```javascript
// Production avatar path
app.use("/avatars", express.static(path.join(__dirname, "../avatars"), { 
  maxAge: "1d" 
}));

// Development avatar path
app.use("/uploads/avatars", express.static(path.join(__dirname, "../uploads/avatars"), { 
  maxAge: "1d" 
}));
```

### 3. Avatar Synchronization

The `sync-avatar-images.js` script synchronizes avatar images from production to the development environment:

- It queries the database for all users with avatar URLs
- Downloads images from the production server
- Saves them to both `/avatars/` and `/uploads/avatars/` directories

This ensures consistent avatar display in both environments.

### 4. File Upload Process

When a user uploads a new avatar:

1. The image is saved to `/uploads/avatars/` with a unique filename
2. The file is then copied to `/avatars/` for production use
3. The avatar URL is stored in the user's profile as `/avatars/[filename]`
4. Both paths can correctly serve the image

## Testing

A test utility is available at `/api/test/avatar-test` to verify avatar image loading from both paths.

## Troubleshooting

If avatar images are not displaying:

1. Verify both directories exist and contain the image files
2. Check file permissions
3. Ensure the static routes are properly configured
4. Verify the URL in the user's database record matches the actual file path

You can use the `/api/test/avatar-files` endpoint to list all available avatar files.

## Production Considerations

When deploying to production:

1. The system will use the `/avatars/` path automatically
2. Both paths will continue to work, ensuring backward compatibility
3. The sync script can be used to ensure all avatars are available in both locations

For new deployments, the system relies on the `processUploadedFile` function in `server/routes.ts` to handle copying files to both locations.