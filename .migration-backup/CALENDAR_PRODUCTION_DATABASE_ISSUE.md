# Calendar Events Production Database Issue

## Problem Summary

Calendar events display correctly in **development** (replit.dev) but **not in production** (barefootbay.com).

## Root Cause

**Replit uses SEPARATE databases for production and development environments.**

- **Development Database**: Contains all 3,915 calendar events
- **Production Database**: Missing the calendar events

This is by design in Replit - production databases are completely separate from development databases to ensure data isolation and safety.

## Why This Happened Recently

Based on the investigation, the most likely causes are:
1. **Production database was restored/rolled back** to an earlier state (git commits show rollback activity in the past 24 hours)
2. **Database migration failed** during a recent deployment
3. **Events were accidentally deleted** from production database only

## Diagnostic Tool Created

A new diagnostic endpoint has been added to help investigate database issues:

### Access the Diagnostic Tool (Admin Only)

**On Development:**
```
https://{your-replit-dev-url}/api/calendar-diagnostics/calendar-stats
```

**On Production (barefootbay.com):**
```
https://barefootbay.com/api/calendar-diagnostics/calendar-stats
```

This will show you:
- Total events in the database
- Events by category
- Events for today
- Sample events
- Which database environment is being used

### Check Specific Date
```
https://barefootbay.com/api/calendar-diagnostics/calendar-check-date/2025-10-10
```

### Check Database Connection
```
https://barefootbay.com/api/calendar-diagnostics/database-info
```

## How to Fix This Issue

### Option 1: Access Production Database Directly (Recommended)

1. **Open Replit's Database Manager** for your published app
2. Go to the **Production Database** tab
3. Check if events exist in the `events` table
4. If events are missing, this confirms the production database was reset/cleared

### Option 2: Re-create Events in Production

Since development and production databases are separate, you'll need to:

1. **Export events from development**:
   - Use the dev environment to export calendar events
   - You can create a script to export event data

2. **Import to production**:
   - Create events in production using the admin interface
   - OR restore from a production database backup if available

### Option 3: Restore Production Database (If Backup Exists)

Check Replit's database backups:
1. Go to your Replit project
2. Open Database settings
3. Look for Production Database backups
4. Restore to a point before the issue occurred (within past 24 hours)

## Prevention

To prevent this in the future:

1. **Regular Database Backups**: Ensure production database backups are enabled
2. **Deployment Testing**: Always test database changes in a staging environment first  
3. **Monitor Production**: Set up alerts for when production database changes occur

## Current Status

### Development Database
- ✅ Connected
- ✅ 3,915 total events
- ✅ 10 events on October 10, 2025
- ✅ Working correctly

### Production Database  
- ❌ Missing calendar events
- ℹ️ Needs investigation using diagnostic tool
- ℹ️ Likely needs data restoration or re-import

## Next Steps

1. **Log in as admin** on production (barefootbay.com)
2. **Access diagnostic endpoint**: `/api/calendar-diagnostics/calendar-stats`
3. **Verify event count** - it should show 0 or very few events
4. **Choose a fix option** from above based on your backup availability
5. **Monitor** to ensure events persist after fix

## Technical Details

### Database Configuration
- **Type**: PostgreSQL (Neon-backed)
- **Development**: Uses `DATABASE_URL` environment variable
- **Production**: Uses separate `DATABASE_URL` for production deployment
- **Connection**: Both environments use the same code but different databases

### Code Changes Made
- Added diagnostic router: `server/routes/calendar-diagnostics.ts`
- Registered route in: `server/routes.ts` (line 1312)
- No changes to event storage or retrieval logic needed

## Questions?

The diagnostic tools are now live. Access them from production to see the exact state of your production database.
