export function toUserFacingErrorMessage(message: string | null | undefined, fallback = 'Something went wrong. Please try again.') {
  const normalized = (message ?? '').trim()
  if (!normalized) return fallback

  const lower = normalized.toLowerCase()

  if (lower.includes('infinite recursion detected in policy for relation "users"')) {
    return 'Account setup is temporarily unavailable due to a server configuration issue. Please try again in a moment.'
  }

  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'You do not have permission to perform that action.'
  }

  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) {
    return 'Network issue detected. Check your connection and try again.'
  }

  if (lower.includes('jwt expired') || lower.includes('invalid jwt') || lower.includes('session')) {
    return 'Your session expired. Please sign in again.'
  }

  if (lower.includes('duplicate key value violates unique constraint')) {
    return 'That record already exists.'
  }

  if (lower.includes('server responded with a status of 500') || lower.includes('internal server error')) {
    return 'Server error. Please try again in a moment.'
  }

  return normalized
}

export function toUserFacingUnknownError(reason: unknown, fallback = 'Something went wrong. Please try again.') {
  if (typeof reason === 'string') return toUserFacingErrorMessage(reason, fallback)
  if (reason instanceof Error) return toUserFacingErrorMessage(reason.message, fallback)
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const value = (reason as { message?: unknown }).message
    if (typeof value === 'string') return toUserFacingErrorMessage(value, fallback)
  }
  return fallback
}
