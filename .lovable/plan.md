

# Differentiate Account Action Buttons with Escalating Colors

## Change

**File**: `src/pages/Settings.tsx`

Three button styling updates:

1. **Log Out** (line 532) — Keep `variant="outline"` as-is. Neutral, everyday action. No change needed.

2. **Logout from all devices** (lines 512-519) — Change to an amber/orange outline style using custom Tailwind classes:
   ```tsx
   <Button 
     variant="outline" 
     size="sm" 
     className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
     onClick={handleLogoutAllDevices}
     disabled={isLoggingOutAll}
   >
   ```

3. **Delete Account** (line 551) — Already solid red (`variant="destructive"`). No change needed.

**Result**: Neutral outline → Amber outline → Solid red — a clear visual escalation matching the severity of each action.

