import { decideAdminAccess } from './adminGuard.ts'
import type { UserRole } from './roles.ts'

export function canAccessAdminMatching(role: UserRole | null | undefined) {
  return decideAdminAccess(role).allowed
}
