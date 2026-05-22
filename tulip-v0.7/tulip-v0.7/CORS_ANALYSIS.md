# Supabase Edge Functions CORS Configuration Analysis

## Executive Summary

This document provides a comprehensive analysis of CORS (Cross-Origin Resource Sharing) configuration for Supabase Edge Functions, with specific focus on payment checkout flows using Stripe. It addresses common preflight failures, debugging strategies, and best practices for Deno-based Edge Functions.

---

## 1. How to Properly Configure CORS Headers in Supabase Edge Functions (Deno)

### 1.1 Recommended Approach (Supabase SDK v2.95.0+)

**Import CORS headers from the Supabase SDK directly:**

```typescript
import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ... rest of function logic
  
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
})
```

**Advantages:**
- Automatically stays synchronized with Supabase SDK updates
- Includes all required headers
- No manual header management

### 1.2 Manual Approach (Compatible with any version)

**For full control or older SDK versions:**

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
```

### 1.3 For Payment Checkout Functions

**Stripe-specific configuration:**

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, stripe-signature, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', {
    status: 204,  // No Content is standard for preflight
    headers: corsHeaders,
  })
}

// Handle actual POST request
if (req.method === 'POST') {
  // ... process checkout
}
```

---

## 2. Common CORS Preflight Failures and Their Causes

### 2.1 Missing OPTIONS Request Handler

**Problem:** Browser receives CORS error instead of preflight response

**Cause:** Function doesn't explicitly handle `OPTIONS` method

```typescript
// ❌ WRONG - No OPTIONS handler
Deno.serve(async (req) => {
  const { name } = await req.json()
  return new Response(JSON.stringify({ message: `Hello ${name}` }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

// ✅ CORRECT - OPTIONS handler first
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  const { name } = await req.json()
  return new Response(JSON.stringify({ message: `Hello ${name}` }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

### 2.2 Missing Required CORS Headers

**Problem:** Browser blocks response with error like "No 'Access-Control-Allow-Origin' header"

**Causes:**
1. **Missing `Access-Control-Allow-Methods`** - Doesn't tell browser what methods are allowed
2. **Missing `Access-Control-Allow-Headers`** - Doesn't whitelist custom headers like `stripe-signature`
3. **Mismatched headers** - Request sends headers not listed in response

**Required for Stripe webhooks:**

```typescript
const corsHeaders = {
  // Essential
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',  // Must include requested method
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  
  // Optional but recommended
  'Access-Control-Max-Age': '86400',  // Cache preflight for 24 hours
}
```

### 2.3 Non-Standard HTTP Status for Preflight

**Problem:** Response status 200 works but 204 is standard

**Best Practice:**

```typescript
if (req.method === 'OPTIONS') {
  // Both work, but 204 is more semantically correct
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}
```

### 2.4 Content-Type Issues with POST Requests

**Problem:** `application/json` POST triggers preflight that might fail

**Issue:** When Content-Type is `application/json`, browsers automatically send preflight

```typescript
// This will trigger preflight because Content-Type is not form-encoded
fetch('https://function/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [...] })
})

// Solution: Always handle OPTIONS
if (req.method === 'OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}
```

### 2.5 Missing Custom Header Whitelist

**Problem:** Stripe signature verification fails silently due to CORS

**Cause:** `stripe-signature` header not in `Access-Control-Allow-Headers`

```typescript
// ❌ WRONG
const corsHeaders = {
  'Access-Control-Allow-Headers': 'content-type',
  // stripe-signature is missing!
}

// ✅ CORRECT
const corsHeaders = {
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, stripe-signature, x-application-name',
}
```

---

## 3. Supabase Built-in CORS Middleware

### Key Points:

- **Supabase DOES NOT provide automatic CORS middleware** that might conflict
- **You must explicitly handle CORS** in your Edge Function code
- **No automatic preflight handling** - you implement it
- **This is by design** - gives you full control

### What This Means:

```typescript
// Supabase Edge Runtime runs your code as-is
// There's no middleware stripping or modifying CORS headers
// You have complete control over every response header

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = { /* your config */ }

serve(async (req) => {
  // 100% your responsibility to:
  // 1. Handle OPTIONS
  // 2. Add CORS headers to responses
  // 3. Manage header validation
})
```

---

## 4. Best Practices for Handling OPTIONS Requests

### 4.1 Complete Pattern for Payment Functions

```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, stripe-signature, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

serve(async (req) => {
  // 1. HANDLE PREFLIGHT FIRST
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  // 2. VALIDATE METHOD
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    // 3. YOUR BUSINESS LOGIC
    const body = await req.json()
    
    // 4. PROCESS (stripe checkout, etc)
    const result = await processCheckout(body)
    
    // 5. RETURN WITH CORS HEADERS
    return jsonResponse(200, result)
  } catch (error) {
    // Even errors need CORS headers
    return jsonResponse(400, { error: error.message })
  }
})
```

### 4.2 Response Pattern for All Edge Cases

```typescript
// Success response
return new Response(JSON.stringify({ success: true }), {
  status: 200,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

// Error response
return new Response(JSON.stringify({ error: 'Invalid request' }), {
  status: 400,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

// Stream response (if applicable)
return new Response(readableStream, {
  status: 200,
  headers: { ...corsHeaders, 'Content-Type': 'application/octet-stream' },
})
```

### 4.3 Early Return Pattern for Preflight

```typescript
// Fastest pattern - exit early
serve(async (req) => {
  // Quick exit for preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Rest of function only executes for actual requests
  // No wasted processing on preflight
})
```

---

## 5. localhost:8080 and Supabase CORS Issues

### 5.1 Known Issues with Local Development

**Problem:** `localhost:8080` requests fail with CORS errors even with proper headers

**Root Causes:**

1. **Port Mismatch**
   - Frontend at `localhost:3000`
   - Function at `localhost:54321` (Supabase CLI)
   - Different ports = cross-origin request

2. **Null Origin Issue**
   - Some development scenarios send `Origin: null`
   - If `Access-Control-Allow-Origin` is `*`, this should work
   - Some browsers block this with wildcards anyway

### 5.2 Solution for Local Testing

**Use wildcard during development:**

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Allows localhost:any-port
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

**For production, use specific origin:**

```typescript
const ALLOWED_ORIGINS = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
]

const origin = req.headers.get('origin') || ''
const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : null

const corsHeaders = {
  'Access-Control-Allow-Origin': corsOrigin || '*',  // Fallback to wildcard
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

### 5.3 Test Local Functions Properly

**Use Supabase CLI:**

```bash
# Terminal 1: Start Supabase locally
supabase start

# Terminal 2: Serve specific function
supabase functions serve create-stripe-checkout-session --no-verify-jwt

# Function runs at: http://localhost:54321/functions/v1/create-stripe-checkout-session
```

**In your frontend (localhost:3000):**

```typescript
const response = await fetch(
  'http://localhost:54321/functions/v1/create-stripe-checkout-session',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [...] }),
  }
)
```

---

## 6. How to Debug CORS Issues

### 6.1 What Headers to Check

**Request Headers (sent by browser in preflight):**

```
OPTIONS /functions/v1/checkout HTTP/1.1
Host: jixfnknfjycbimazuvdk.supabase.co
Origin: http://localhost:3000
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type,stripe-signature
```

**Response Headers (sent by function):**

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, stripe-signature
Access-Control-Max-Age: 86400
```

### 6.2 Browser DevTools Debugging

**Steps:**

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Make a cross-origin request**
4. **Look for OPTIONS request** (before actual POST)
5. **Click it and check Response Headers:**
   - Is `Access-Control-Allow-Origin` present?
   - Does `Access-Control-Allow-Methods` include your method?
   - Does `Access-Control-Allow-Headers` include all your request headers?

### 6.3 Console Error Examples and Solutions

**Error:** `No 'Access-Control-Allow-Origin' header is present`
```typescript
// Add to function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Add this
}
```

**Error:** `Method not allowed by Access-Control-Allow-Methods`
```typescript
// Ensure method is listed
const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',  // Include your method
}
```

**Error:** `Header 'stripe-signature' not allowed by Access-Control-Allow-Headers`
```typescript
// Add custom header to whitelist
const corsHeaders = {
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, stripe-signature',  // Add it
}
```

### 6.4 Manual Testing with curl

**Test preflight:**

```bash
curl -X OPTIONS http://localhost:54321/functions/v1/checkout \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v
```

**Check response headers:**

```bash
# Look for:
# < Access-Control-Allow-Origin: *
# < Access-Control-Allow-Methods: POST, OPTIONS
# < Access-Control-Allow-Headers: content-type
```

**Test actual request:**

```bash
curl -X POST http://localhost:54321/functions/v1/checkout \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"items": [...]}' \
  -v
```

### 6.5 Programmatic Verification

**Add logging to function:**

```typescript
serve(async (req) => {
  const method = req.method
  const origin = req.headers.get('origin')
  const requestHeaders = req.headers.get('access-control-request-headers')
  
  console.log(`Method: ${method}`)
  console.log(`Origin: ${origin}`)
  console.log(`Request Headers: ${requestHeaders}`)
  
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }
  
  // ... rest
})
```

---

## 7. Code Patterns for Payment Checkout Functions

### 7.1 Complete Stripe Checkout Example

```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type, stripe-signature, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY')!, {
  apiVersion: '2024-11-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
)

interface CheckoutRequest {
  items: Array<{ id: string; quantity: number }>
  userId?: string
  successUrl: string
  cancelUrl: string
}

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const body: CheckoutRequest = await req.json()

    // Validate request
    if (!body.items || !Array.isArray(body.items)) {
      return jsonResponse(400, { error: 'Invalid items' })
    }

    // Create line items for Stripe
    const lineItems = body.items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Product ${item.id}`,
        },
        unit_amount: 2999, // $29.99
      },
      quantity: item.quantity,
    }))

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: body.successUrl || 'https://example.com/success',
      cancel_url: body.cancelUrl || 'https://example.com/cancel',
    })

    // Store session in database
    if (body.userId) {
      const { error } = await supabase
        .from('checkout_sessions')
        .insert({
          user_id: body.userId,
          stripe_session_id: session.id,
          status: 'pending',
        })

      if (error) {
        console.error('Database error:', error)
        // Continue anyway - stripe session is created
      }
    }

    return jsonResponse(200, {
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})
```

### 7.2 Minimal Working Example

```typescript
import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    
    // Your logic here
    const result = await processPayment(body)
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

---

## 8. Configuration Checklist for Payment Functions

- [ ] **OPTIONS handler** first in function
- [ ] **CORS headers on all responses** (success and error)
- [ ] **`stripe-signature` in Allow-Headers** if handling webhooks
- [ ] **`Access-Control-Allow-Methods` includes POST and OPTIONS**
- [ ] **Status 204 for preflight** responses
- [ ] **Stripe environment variables** set in Supabase dashboard
- [ ] **Local testing** with `supabase functions serve --no-verify-jwt`
- [ ] **DevTools Network tab** inspected for CORS errors
- [ ] **Error responses** include CORS headers
- [ ] **Max-Age header** set to reduce preflight calls (86400 = 24 hrs)

---

## Summary

**Key Takeaways:**

1. **Always handle OPTIONS requests** - Preflight must return 204 + CORS headers
2. **Include custom headers in whitelist** - Add `stripe-signature` for payment processing
3. **Use SDK corsHeaders when possible** - Stays in sync with updates
4. **All responses need CORS headers** - Errors too
5. **localhost:* works fine with wildcard origin** - Good for development
6. **Use DevTools Network tab** - Best debugging tool for CORS issues
7. **Test with curl for verification** - Confirms headers are being sent
8. **No built-in CORS middleware** - You control everything

