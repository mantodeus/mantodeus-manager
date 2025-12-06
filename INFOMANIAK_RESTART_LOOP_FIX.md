# Infomaniak Restart Loop Fix

## Problem

The application was stuck in a restart loop on Infomaniak. When the server failed to start (due to missing environment variables, database connection issues, port conflicts, etc.), the process would exit immediately, causing Infomaniak's process manager to restart it, creating an infinite loop.

## Root Cause

The original error handling in `server/_core/index.ts` was:

```typescript
startServer().catch(console.error);
```

This would:
1. Log errors to console but not prevent process exit
2. Exit immediately with code 1 on any startup failure
3. Trigger Infomaniak to restart the process
4. Same error occurs again → infinite restart loop

## Solution Applied

### 1. Improved Error Handling

Added comprehensive error handling that:
- **Delays exit by 5 seconds** to prevent rapid restart loops
- **Logs detailed error information** for debugging
- **Handles different types of errors** appropriately

```typescript
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  console.error("Error details:", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  
  // Wait 5 seconds before exiting to prevent rapid restart loops
  setTimeout(() => {
    console.error("Exiting after startup failure...");
    process.exit(1);
  }, 5000);
});
```

### 2. Graceful Shutdown Handling

Added handlers for SIGTERM and SIGINT signals:

```typescript
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

### 3. Uncaught Exception Handling

Added handlers for uncaught exceptions and unhandled rejections:

```typescript
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  console.error("Stack:", error.stack);
  
  // Exit with delay to prevent rapid restart loops
  setTimeout(() => {
    console.error("Exiting due to uncaught exception...");
    process.exit(1);
  }, serverStarted ? 5000 : 2000);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Log but don't exit immediately - they're often recoverable
});
```

### 4. Port Conflict Detection

Added error handling for server listen errors (e.g., port already in use):

```typescript
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Please stop the other process or use a different port.`);
  } else {
    console.error("Server error:", error);
  }
});
```

### 5. Build Verification

Added check to verify build output exists before starting:

```typescript
if (process.env.NODE_ENV === "production") {
  const distIndexPath = path.resolve(__dirname, "../index.js");
  if (!fs.existsSync(distIndexPath)) {
    throw new Error(
      `Production build not found at ${distIndexPath}. ` +
      `Please run 'npm run build' before starting the server.`
    );
  }
}
```

## Benefits

1. **Prevents Rapid Restart Loops**: 5-second delay gives time for logs to be written and prevents system hammering
2. **Better Error Visibility**: Detailed error logging helps diagnose issues
3. **Graceful Shutdown**: Proper handling of shutdown signals
4. **Early Error Detection**: Build verification catches missing build files early
5. **Port Conflict Detection**: Clear error messages for common issues

## Common Causes of Restart Loops

1. **Missing Environment Variables**: Supabase, database, or S3 credentials not set
2. **Database Connection Failure**: Database URL incorrect or database unavailable
3. **Port Already in Use**: Another process using port 3000
4. **Missing Build Files**: `dist/index.js` not created during build
5. **Module Import Errors**: Missing dependencies or incorrect imports

## How to Debug

If you're still experiencing restart loops:

1. **Check Infomaniak Logs**: Look for the detailed error messages we now log
2. **Verify Environment Variables**: Ensure all required vars are set in Infomaniak dashboard
3. **Check Build Output**: Verify `dist/index.js` exists after build
4. **Check Port**: Ensure port 3000 is available
5. **Check Database**: Verify database connection string is correct

## Testing

To test the fix locally:

```bash
# Simulate missing env var
unset DATABASE_URL
npm start
# Should exit after 5 seconds with clear error message

# Simulate port conflict
# Start server in one terminal, then try to start again
npm start
# Should show clear error about port in use
```

## Files Modified

- `server/_core/index.ts` - Added comprehensive error handling

## Next Steps

1. Commit and push these changes
2. Deploy to Infomaniak
3. Monitor logs for any startup errors
4. The 5-second delay should prevent rapid restart loops and make errors visible in logs
