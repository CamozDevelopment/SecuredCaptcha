# Integration Guide

## Quick Integration

### 1. Include the Widget Script

Add this to your HTML page:

```html
<script src="https://your-domain.com/widget.js"></script>
```

### 2. Add a Container

Create a div where the CAPTCHA will appear:

```html
<div id="captcha-container"></div>
```

### 3. Render the CAPTCHA

```html
<script>
  SecuredCaptcha.render('captcha-container', {
    siteKey: 'your-site-key',
    callback: function(token) {
      console.log('User verified! Token:', token);
      // Enable your form submit button
      document.getElementById('submit-btn').disabled = false;
    }
  });
</script>
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Contact Form</title>
</head>
<body>
  <form id="contact-form">
    <input type="email" name="email" placeholder="Email" required>
    <textarea name="message" placeholder="Message" required></textarea>
    
    <!-- CAPTCHA -->
    <div id="captcha-container"></div>
    
    <button type="submit" id="submit-btn" disabled>Submit</button>
  </form>

  <script src="https://your-domain.com/widget.js"></script>
  <script>
    let verificationToken = null;

    // Render CAPTCHA
    SecuredCaptcha.render('captcha-container', {
      siteKey: 'your-site-key',
      callback: function(token) {
        verificationToken = token;
        document.getElementById('submit-btn').disabled = false;
      }
    });

    // Handle form submission
    document.getElementById('contact-form').addEventListener('submit', async function(e) {
      e.preventDefault();

      if (!verificationToken) {
        alert('Please complete the verification');
        return;
      }

      // Send to your backend
      const formData = new FormData(this);
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.get('email'),
          message: formData.get('message'),
          captchaToken: verificationToken
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('Form submitted successfully!');
        this.reset();
      }
    });
  </script>
</body>
</html>
```

## Server-Side Verification

On your backend, verify the token before processing the form:

### Node.js/Express Example

```javascript
app.post('/api/submit-form', async (req, res) => {
  const { email, message, captchaToken } = req.body;

  // Verify the CAPTCHA token
  const verifyResponse = await fetch('https://your-captcha-domain.com/api/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: captchaToken,
      siteKey: 'your-site-key'
    })
  });

  const verifyResult = await verifyResponse.json();

  if (!verifyResult.success) {
    return res.status(400).json({ error: 'CAPTCHA verification failed' });
  }

  // Process the form
  // ... your form handling code ...

  res.json({ success: true });
});
```

### PHP Example

```php
<?php
$captchaToken = $_POST['captchaToken'];

$data = array(
    'token' => $captchaToken,
    'siteKey' => 'your-site-key'
);

$options = array(
    'http' => array(
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    )
);

$context = stream_context_create($options);
$result = file_get_contents('https://your-captcha-domain.com/api/verify', false, $context);
$response = json_decode($result);

if ($response->success) {
    // Process the form
    echo json_encode(['success' => true]);
} else {
    http_response_code(400);
    echo json_encode(['error' => 'CAPTCHA verification failed']);
}
?>
```

### Python Example

```python
import requests

def verify_captcha(token, site_key):
    response = requests.post('https://your-captcha-domain.com/api/verify', json={
        'token': token,
        'siteKey': site_key
    })
    
    result = response.json()
    return result.get('success', False)

# In your form handler
if verify_captcha(captcha_token, 'your-site-key'):
    # Process the form
    pass
else:
    # Reject the submission
    pass
```

## Configuration Options

### Widget Options

```javascript
SecuredCaptcha.render('captcha-container', {
  siteKey: 'your-site-key',     // Required: Your site key
  callback: function(token) {}, // Required: Called when verified
  theme: 'light',               // Optional: 'light' or 'dark'
  size: 'normal'                // Optional: 'normal' or 'compact'
});
```

### Custom API URL

If you want to use a custom API URL:

```html
<script>
  // Set before loading widget.js
  window.SECURED_CAPTCHA_API_URL = 'https://custom-api.com/api';
</script>
<script src="https://your-domain.com/widget.js"></script>
```

## Styling Customization

The widget uses CSS classes that you can override:

```css
/* Customize the container */
.secured-captcha {
  border: 2px solid #your-color !important;
  border-radius: 12px !important;
}

/* Customize the footer */
.secured-captcha-footer {
  background: #your-color !important;
}

/* Customize text color */
.secured-captcha p {
  color: #your-color !important;
}
```

## Managing Site Keys

Site keys are simple strings you define. Use different keys for different domains:

- `production-site-key` - For your main website
- `staging-site-key` - For testing
- `client-site-key` - For client projects

Store them in your backend configuration and pass them when verifying tokens.

## Best Practices

1. **Always verify tokens on your backend** - Never trust client-side verification alone

2. **Use HTTPS** - Always serve the widget and API over HTTPS in production

3. **Set appropriate CORS origins** - Only allow your domains in the API configuration

4. **Handle errors gracefully** - Show user-friendly messages if verification fails

5. **Don't reuse tokens** - Each form submission should use a fresh verification

6. **Set rate limits** - Prevent abuse by limiting requests per IP

## Common Issues

### Widget Not Appearing

- Check that the script is loaded: `console.log(window.SecuredCaptcha)`
- Verify the container element exists
- Check browser console for errors

### Verification Failing

- Ensure the token hasn't expired (5 minutes default)
- Verify the site key matches between widget and backend
- Check that CORS is configured correctly

### CORS Errors

Add your domain to `ALLOWED_ORIGINS` in the API server's `.env` file:

```
ALLOWED_ORIGINS=https://your-site.com,https://www.your-site.com
```

## Advanced Usage

### Multiple Widgets on One Page

```javascript
// First widget
SecuredCaptcha.render('captcha-1', {
  siteKey: 'key-1',
  callback: function(token) { /* ... */ }
});

// Second widget (create a new instance)
const captcha2 = new SecuredCaptcha();
captcha2.render('captcha-2', {
  siteKey: 'key-2',
  callback: function(token) { /* ... */ }
});
```

### Programmatic Reset

To reset the widget after submission:

```javascript
// Reload the page
location.reload();

// Or recreate the widget
document.getElementById('captcha-container').innerHTML = '';
SecuredCaptcha.render('captcha-container', options);
```

## Support

For integration help or issues, contact the package provider.
