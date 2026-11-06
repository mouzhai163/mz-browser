export type { TeamMember } from '../components/team-table-row';

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type TeamStatus = 'active' | 'pending' | 'inactive';

export type RoleFilter = 'all' | 'admin' | 'editor' | 'viewer';

export interface Team {
  id: string;
  name: string;
}
