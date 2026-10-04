-- Member bereavement: DECEASED is a distinct terminal status from EXITED so
-- death-related records (welfare claims, settlements) remain traceable.
ALTER TYPE "OrganizationMemberStatus" ADD VALUE IF NOT EXISTS 'DECEASED';
