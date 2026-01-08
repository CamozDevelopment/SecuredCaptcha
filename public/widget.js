(function() {
  'use strict';

  const API_URL = 'http://localhost:3000/api/v1'; // change it to the uh yk domain i setup one day
  
  // SecuredCaptcha main class
  class SecuredCaptcha {
    constructor() {
      this.challenges = new Map();
      this.fingerprint = this.generateFingerprint();
      this.mouseMovements = [];
      this.keystrokes = [];
      this.requestTimings = [];
    }

    // Generate browser fingerprint
    generateFingerprint() {
      const components = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        this.getCanvasFingerprint(),
        this.getWebGLFingerprint()
      ];
      
      return this.hashString(components.join('|'));
    }

    // Canvas fingerprinting
    getCanvasFingerprint() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('SecuredCaptcha', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('SecuredCaptcha', 4, 17);
        
        return canvas.toDataURL();
      } catch (e) {
        return '';
      }
    }

    // WebGL fingerprinting
    getWebGLFingerprint() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return '';
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return '';
        
        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      } catch (e) {
        return '';
      }
    }

    // Simple hash function
    hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    }

    // Track mouse movements
    trackMouseMovement(e) {
      this.mouseMovements.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now()
      });
      
      // Keep only last 50 movements
      if (this.mouseMovements.length > 50) {
        this.mouseMovements.shift();
      }
    }

    // Track keystrokes
    trackKeystroke(e) {
      this.keystrokes.push({
        key: e.key,
        timestamp: Date.now()
      });
      
      // Keep only last 30 keystrokes
      if (this.keystrokes.length > 30) {
        this.keystrokes.shift();
      }
    }

    // Render widget
    render(containerId, options) {
      console.log('SecuredCaptcha.render called with:', containerId, options);
      
      const container = document.getElementById(containerId);
      if (!container) {
        console.error('SecuredCaptcha: Container not found:', containerId);
        return;
      }

      console.log('Container found:', container);

      const siteKey = options.siteKey;
      const callback = options.callback || function() {};
      const theme = options.theme || 'light';
      const size = options.size || 'normal';

      // Create widget HTML
      const widgetHTML = `
        <div class="secured-captcha ${theme} ${size}">
          <div class="secured-captcha-inner">
            <div class="secured-captcha-loader">
              <div class="spinner"></div>
              <p>Verifying you are human...</p>
            </div>
            <div class="secured-captcha-success" style="display: none;">
              <svg class="checkmark" viewBox="0 0 52 52">
                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
              </svg>
              <p>Verification complete</p>
            </div>
            <div class="secured-captcha-error" style="display: none;">
              <p class="error-message"></p>
              <button class="retry-btn">Try Again</button>
            </div>
          </div>
          <div class="secured-captcha-footer">
            <span>Protected by <strong>SecuredAPI</strong></span>
          </div>
        </div>
      `;

      console.log('Setting innerHTML...');
      container.innerHTML = widgetHTML;
      console.log('Injecting styles...');
      this.injectStyles();

      console.log('Starting verification...');
      // Start verification process
      this.verify(container, siteKey, callback);

      // Track user interactions
      document.addEventListener('mousemove', this.trackMouseMovement.bind(this));
      document.addEventListener('keydown', this.trackKeystroke.bind(this));
    }

    // Verify user
    async verify(container, siteKey, callback) {
      const loader = container.querySelector('.secured-captcha-loader');
      const success = container.querySelector('.secured-captcha-success');
      const error = container.querySelector('.secured-captcha-error');

      try {
        this.requestTimings.push(Date.now());

        // Create challenge
        const createResponse = await fetch(`${API_URL}/challenge/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            siteKey,
            fingerprint: this.fingerprint,
            mouseMovements: this.mouseMovements,
            keystrokes: this.keystrokes,
            requestTimings: this.requestTimings
          })
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
          throw new Error(createData.error || 'Failed to create challenge');
        }

        // If high risk, require user interaction
        if (createData.requiresInteraction) {
          await this.showInteractiveChallenge(container, createData);
        }

        // Small delay to appear more natural
        await this.delay(800 + Math.random() * 400);

        // Verify challenge
        const verifyResponse = await fetch(`${API_URL}/challenge/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: createData.token,
            fingerprint: this.fingerprint
          })
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || !verifyData.success) {
          throw new Error(verifyData.error || 'Verification failed');
        }

        // Show success
        loader.style.display = 'none';
        success.style.display = 'flex';

        // Call callback with token
        callback(createData.token);

      } catch (err) {
        loader.style.display = 'none';
        error.style.display = 'flex';
        error.querySelector('.error-message').textContent = err.message;

        // Retry button
        error.querySelector('.retry-btn').onclick = () => {
          error.style.display = 'none';
          loader.style.display = 'flex';
          this.verify(container, siteKey, callback);
        };
      }
    }

    // Show interactive challenge for high-risk users
    async showInteractiveChallenge(container, challengeData) {
      return new Promise((resolve) => {
        const loader = container.querySelector('.secured-captcha-loader');
        loader.innerHTML = `
          <div class="interactive-challenge">
            <p>Click the checkbox to verify</p>
            <label class="checkbox-container">
              <input type="checkbox" id="verify-checkbox">
              <span class="checkmark-box"></span>
              <span>I'm not a robot</span>
            </label>
          </div>
        `;

        const checkbox = document.getElementById('verify-checkbox');
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            setTimeout(resolve, 500);
          }
        });
      });
    }

    // Utility: delay
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Inject CSS styles
    injectStyles() {
      if (document.getElementById('secured-captcha-styles')) return;

      const styles = `
        .secured-captcha {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px;
          width: 100%;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }

        .secured-captcha-inner {
          padding: 20px;
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-direction: row;
        }

        .secured-captcha-loader,
        .secured-captcha-success,
        .secured-captcha-error {
          display: flex;
          text-align: left;
          flex-direction: row;
          align-items: center;
          width: 100%;
          gap: 15px;
        }

        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #3498db;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .checkmark {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
        }

        .checkmark-circle {
          stroke: #4caf50;
          stroke-width: 2;
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }

        .checkmark-check {
          stroke: #4caf50;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.4s forwards;
        }

        @keyframes stroke {
          100% { stroke-dashoffset: 0; }
        }

        .secured-captcha p {
          margin: 0;
          color: #666;
          font-size: 14px;
          flex: 1;
        }

        .secured-captcha-footer {
          background: #f5f5f5;
          padding: 6px 12px;
          font-size: 11px;
          color: #999;
          text-align: right;
          border-top: 1px solid #ddd;
        }

        .secured-captcha-footer strong {
          color: #3498db;
        }

        .retry-btn {
          padding: 6px 16px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          flex-shrink: 0;
        }

        .retry-btn:hover {
          background: #2980b9;
        }

        .error-message {
          color: #e74c3c;
          flex: 1;
        }

        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .checkmark-box {
          width: 20px;
          height: 20px;
          border: 2px solid #ddd;
          border-radius: 3px;
          display: inline-block;
          flex-shrink: 0;
        }

        input[type="checkbox"]:checked + .checkmark-box {
          background: #3498db;
          border-color: #3498db;
        }

        input[type="checkbox"] {
          display: none;
        }
      `;

      const styleSheet = document.createElement('style');
      styleSheet.id = 'secured-captcha-styles';
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }
  }

  // Expose to global scope
  window.SecuredCaptcha = new SecuredCaptcha();
})();
