# How to Check Logs for Mantodeus Manager

## Server-Side Logs (PM2)

Your server uses PM2 to manage the Node.js process. Here's how to check logs:

### Quick Commands

**1. View recent logs (last 200 lines):**
```bash
cd /srv/customer/sites/manager.mantodeus.com
npx pm2 logs mantodeus-manager --lines 200
```

**2. View live logs (real-time):**
```bash
npx pm2 logs mantodeus-manager --lines 0
```
Press `Ctrl+C` to stop watching.

**3. Filter for expense-related errors:**
```bash
npx pm2 logs mantodeus-manager --lines 200 | grep -i "\[Expenses\]"
```

**4. Filter for scan receipt errors:**
```bash
npx pm2 logs mantodeus-manager --lines 200 | grep -i "ScanReceipt\|expense\|error"
```

**5. View all recent errors:**
```bash
npx pm2 logs mantodeus-manager --lines 500 | grep -i error
```

### What to Look For

When scanning a receipt fails, look for these log entries:

1. **Expense Creation Attempt:**
   ```
   [Expenses] createManualExpense called: { userId: ..., supplierName: "Receipt Scan", ... }
   ```

2. **Gross Amount Value:**
   ```
   [Expenses] Creating expense with grossAmountCents: 1
   ```

3. **Success:**
   ```
   [Expenses] Expense created successfully: 123
   ```

4. **Errors:**
   ```
   [Expenses] Failed to create manual expense: [error details]
   [Expenses] Error details: { message: "...", stack: "..." }
   ```

### Save Logs to File

To save logs for analysis:
```bash
npx pm2 logs mantodeus-manager --lines 500 > expense-errors.log 2>&1
```

Then download the file and search for `[Expenses]` or `[ScanReceipt]`.

---

## Client-Side Logs (Mobile Browser)

### Option 1: Remote Debugging (Recommended)

#### Android (Chrome DevTools)
1. Connect your Android device via USB
2. Enable USB debugging on your device
3. Open Chrome on your computer
4. Go to `chrome://inspect`
5. Click "Inspect" on your device
6. Open the Console tab to see logs

#### iOS (Safari Web Inspector)
1. On iPhone/iPad: Settings → Safari → Advanced → Web Inspector (enable)
2. Connect device to Mac via USB
3. On Mac: Safari → Develop → [Your Device] → [Your Website]
4. Open the Console to see logs

### Option 2: Use a Logging Service

You can temporarily add a logging endpoint to send errors to your server:

```javascript
// This would send errors to your server
fetch('/api/log-error', {
  method: 'POST',
  body: JSON.stringify({ error: errorMessage, timestamp: new Date() })
});
```

### Option 3: Display Errors in UI

The error message now shows a timestamp. Match it with server logs:
- Error shows: "Error logged at: 14:30:25"
- Check server logs around that time

---

## Quick Debugging Workflow

1. **Start watching logs:**
   ```bash
   npx pm2 logs mantodeus-manager --lines 0
   ```

2. **Try scanning a receipt on mobile**

3. **Watch for these log entries:**
   - `[ScanReceipt] Creating new expense for receipt scan`
   - `[Expenses] createManualExpense called:`
   - `[Expenses] Creating expense with grossAmountCents:`
   - `[Expenses] Expense created successfully:` OR `[Expenses] Failed to create manual expense:`

4. **Copy the error message** and share it for debugging

---

## Common Error Patterns

### Validation Error
```
Gross amount must be positive
```
**Fix:** The `grossAmountCents` is 0 or negative. Should default to 1.

### Database Error
```
Database not available
```
**Fix:** Check database connection.

### Permission Error
```
You don't have access to this expense
```
**Fix:** User ownership issue.

---

## Need Help?

If you see an error in the logs, share:
1. The full error message from `[Expenses] Failed to create manual expense:`
2. The error details object
3. The timestamp when it occurred

