/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth config for testing
vi.mock('../../config/auth', () => ({
  authConfig: {
    bypassAuth: true,
    environment: 'development',
    keycloak: {
      authority: 'http://localhost:8080/realms/spending-monitor',
      clientId: 'spending-monitor',
      redirectUri: 'http://localhost:3000',
      postLogoutRedirectUri: 'http://localhost:3000',
    },
  },
}));

// Mock react-oidc-context
vi.mock('react-oidc-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }),
}));

// Mock fetch for DevAuthProvider API call
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      id: '1',
      email: 'john.doe@example.com',
      first_name: 'John',
      last_name: 'Doe',
    }),
  })
) as unknown as typeof fetch;

describe('useAuth', () => {
  it('should return dev user in development mode', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    // Wait for the async user fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // After loading, should have the dev user
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe('John Doe');
    expect(result.current.user?.email).toBe('john.doe@example.com');
    expect(result.current.user?.isDevMode).toBe(true);
    expect(result.current.user?.roles).toEqual(['user', 'admin']);
  });

  it('should provide login and logout functions', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.signinRedirect).toBe('function');
    expect(result.current.error).toBe(null);
  });
});
