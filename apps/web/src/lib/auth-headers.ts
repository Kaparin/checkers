const TOKEN_KEY = 'checkers_auth_token'
const ADDRESS_KEY = 'checkers_connected_address'

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function getStoredAddress(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ADDRESS_KEY)
}

export function setStoredAddress(address: string) {
  sessionStorage.setItem(ADDRESS_KEY, address)
}

export function clearStoredAddress() {
  sessionStorage.removeItem(ADDRESS_KEY)
}
