/**
 * Authentication configuration
 * Handles both development bypass and production OIDC setup
 */

export interface AuthConfig {
  bypassAuth: boolean;
  environment: 'development' | 'production' | 'staging' | 'test';
  keycloak: {
    authority: string;
    clientId: string;
    redirectUri: string;
    postLogoutRedirectUri: string;
  };
}

// Environment detection
const environment = (import.meta.env.VITE_ENVIRONMENT ||
  'development') as AuthConfig['environment'];

// Bypass detection - auto-enable in development unless explicitly disabled
const bypassAuth =
  import.meta.env.VITE_BYPASS_AUTH === 'true' ||
  (environment === 'development' && import.meta.env.VITE_BYPASS_AUTH !== 'false');

export const authConfig: AuthConfig = {
  environment,
  bypassAuth,
  keycloak: {
    authority:
      import.meta.env.VITE_KEYCLOAK_URL ||
      'http://localhost:8080/realms/spending-monitor',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'spending-monitor',
    redirectUri:
      import.meta.env.VITE_KEYCLOAK_REDIRECT_URI ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000'),
    postLogoutRedirectUri:
      import.meta.env.VITE_KEYCLOAK_POST_LOGOUT_REDIRECT_URI ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000'),
  },
};

// Log configuration for debugging (only in development)
if (import.meta.env.DEV) {
  console.log('🔐 Auth Configuration:', {
    environment: authConfig.environment,
    bypassAuth: authConfig.bypassAuth,
    keycloakConfigured: !!authConfig.keycloak.authority,
  });

  if (authConfig.bypassAuth) {
    console.log('🔓 Development Mode: Authentication bypassed');
  } else {
    console.log('🔒 Production Mode: OIDC authentication enabled');
  }
}
