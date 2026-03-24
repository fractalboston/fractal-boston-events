# Fractal Boston Events API Documentation

This API provides endpoints for managing email subscriptions to Fractal Boston event notifications.

## Base URL

Production: `https://fractal-boston-events.vercel.app` (or your deployed URL)

## CORS

All endpoints support CORS and allow requests from `https://fractal.boston`. Preflight OPTIONS requests are automatically handled.

## Endpoints

### POST /api/subscribe

Subscribe an email address to event notifications.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "message": "Verification email sent",
    "email": "user@example.com"
  }
}
```

**Response** (200 OK - Already subscribed):
```json
{
  "success": true,
  "data": {
    "message": "Already subscribed",
    "email": "user@example.com"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid email address
- `500 Internal Server Error`: Server error

**Example (fetch)**:
```javascript
const response = await fetch('https://fb-events.vercel.app/api/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: 'user@example.com' })
});

const data = await response.json();
```

### POST /api/verify

Verify an email address subscription using a token from the verification email.

**Authentication**: Not required

**Request Body**:
```json
{
  "token": "uuid-token-from-email"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully",
    "email": "user@example.com"
  }
}
```

**Response** (200 OK - Already verified):
```json
{
  "success": true,
  "data": {
    "message": "Already verified",
    "email": "user@example.com"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid token or email already unsubscribed
- `404 Not Found`: Token not found
- `500 Internal Server Error`: Server error

**Example (fetch)**:
```javascript
// Token comes from URL query parameter: ?token=xxx
const token = new URLSearchParams(window.location.search).get('token');

const response = await fetch('https://fb-events.vercel.app/api/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token })
});

const data = await response.json();
if (data.success) {
  console.log('Email verified:', data.data.email);
}
```

### POST /api/unsubscribe

Unsubscribe an email address from event notifications using a token from the unsubscribe link in emails.

**Authentication**: Not required

**Request Body**:
```json
{
  "token": "uuid-token-from-email"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Successfully unsubscribed",
    "email": "user@example.com"
  }
}
```

**Response** (200 OK - Already unsubscribed):
```json
{
  "success": true,
  "data": {
    "message": "Already unsubscribed",
    "email": "user@example.com"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid token
- `404 Not Found`: Token not found
- `500 Internal Server Error`: Server error

**Example (fetch)**:
```javascript
// Token comes from URL query parameter: ?token=xxx
const token = new URLSearchParams(window.location.search).get('token');

const response = await fetch('https://fb-events.vercel.app/api/unsubscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token })
});

const data = await response.json();
if (data.success) {
  console.log('Unsubscribed:', data.data.email);
}
```

## Response Format

All endpoints return JSON with a consistent format:

**Success Response**:
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Integration Example (fractal.boston)

### Subscribe Form

```typescript
async function handleSubscribe(email: string) {
  try {
    const response = await fetch('https://fb-events.vercel.app/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    
    if (data.success) {
      // Show success message
      alert('Verification email sent!');
    } else {
      // Show error message
      alert(`Error: ${data.error}`);
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    alert('Failed to subscribe. Please try again.');
  }
}
```

### Verify Page

```typescript
// In your verify page component
useEffect(() => {
  const token = new URLSearchParams(window.location.search).get('token');
  
  if (!token) {
    setError('Missing verification token');
    return;
  }

  async function verifyEmail() {
    try {
      const response = await fetch('https://fb-events.vercel.app/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Email ${data.data.email} verified successfully!`);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Verify error:', error);
      setError('Failed to verify email. Please try again.');
    }
  }

  verifyEmail();
}, []);
```

### Unsubscribe Page

```typescript
// In your unsubscribe page component
useEffect(() => {
  const token = new URLSearchParams(window.location.search).get('token');
  
  if (!token) {
    setError('Missing unsubscribe token');
    return;
  }

  async function unsubscribeEmail() {
    try {
      const response = await fetch('https://fb-events.vercel.app/api/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Email ${data.data.email} unsubscribed successfully.`);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      setError('Failed to unsubscribe. Please try again.');
    }
  }

  unsubscribeEmail();
}, []);
```

## Notes

- All endpoints use POST method (no GET support)
- Tokens are UUIDs sent via email links
- Email links point to `https://fractal.boston/verify?token=xxx` and `https://fractal.boston/unsubscribe?token=xxx`
- The frontend pages (`/verify` and `/unsubscribe`) are hosted on the fractal.boston site, not this API
- CORS is configured to allow requests from `https://fractal.boston`
