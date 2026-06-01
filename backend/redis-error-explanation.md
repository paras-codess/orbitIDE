# 🔍 Redis Rate-Limiter Connection Issue Explained

This document details the root cause of the connection issues encountered with **Upstash Redis** during the signup flow, and how the architectural fix resolves it.

---

## 🛠️ The Architecture & The Failure Flow

When the `express-rate-limit` middleware uses a Redis store (`rate-limit-redis`) to track API request limits, it depends on an active Redis connection. On free-tier Upstash instances, idle connections are occasionally terminated. 

The sequence diagram below shows how a dropped Redis connection caused the registration request to crash with a `500 Internal Server Error` before the architectural fix was applied:

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant Server as Express Server
    participant Limiter as Rate Limiter Middleware
    participant Store as Redis Store (rate-limit-redis)
    participant Redis as Redis Client (ioredis)
    participant Upstash as Upstash Redis (Cloud)
    participant DB as Postgres Database (Supabase)

    %% Step 1: Request
    User->>Server: POST /api/auth/register (Sign up)
    
    %% Step 2: Rate Limiter Interception
    Server->>Limiter: Pass request to Rate Limiter
    
    %% Step 3: Redis Check
    Limiter->>Store: Increment request count for IP
    
    %% Step 4: Redis Command Execution
    Store->>Redis: Execute command: redis.call(...)
    
    %% Step 5: Redis connection status
    note over Redis,Upstash: Upstash closed connection<br/>(free-tier connection limits exceeded)
    Redis-->>Redis: Detects connection state is 'closed'
    
    %% Step 6: Failure
    Redis--X Store: Throws "Error: Connection is closed"
    
    %% Step 7: Crash Flow (passOnStoreError = false)
    Store--X Limiter: Propagates unhandled connection error
    note over Limiter: passOnStoreError is FALSE by default.<br/>Limiter crashes and blocks the request!
    
    %% Step 8: Express Handback
    Limiter--X Server: Middleware throws error
    Server-->>User: Returns 500 Internal Server Error
    
    %% Database is never reached!
    note over DB: Database register code in authController<br/>is never executed!
```

---

## 💡 The Architectural Fix

We resolved this by making the rate-limiting middleware **resilient to Redis connection drops** in `backend/src/middleware/rateLimiter.js`:

1. **`passOnStoreError: true`**:
   We enabled this built-in option in `express-rate-limit`. If the Redis store throws any connection or execution error (like `Connection is closed`), the rate-limiter catches the error, logs a warning, and **silently allows the request to pass through** instead of blocking it with a 500 error.

2. **Connection Status Safety Check**:
   Before sending a command to Redis, the custom `sendCommand` callback now verifies:
   ```javascript
   if (redis.status !== "ready") {
     throw new Error("Redis is not connected");
   }
   ```
   This prevents waiting for network timeouts and instantly triggers the graceful fallback when Redis is offline.

Now, even if Redis goes completely offline, your application continues to work flawlessly for all core operations (login, signup, etc.) using database verification!
