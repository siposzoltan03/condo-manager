# Test Accounts

All accounts use password: `password123`

| Email | Name | Role | Unit | Primary Contact |
|-------|------|------|------|-----------------|
| superadmin@condo.local | Nagy István | SUPER_ADMIN | 1A (Ground) | Yes |
| admin@condo.local | Kovács Mária | ADMIN | 1B (Ground) | Yes |
| board@condo.local | Szabó Péter | BOARD_MEMBER | 2A (1st floor) | Yes |
| resident1@condo.local | Tóth Anna | RESIDENT | 2B (1st floor) | Yes |
| resident2@condo.local | Horváth László | RESIDENT | 3A (2nd floor) | Yes |
| resident3@condo.local | Varga Katalin | RESIDENT | 1A (Ground) | No |
| tenant1@condo.local | Molnár Gábor | TENANT | 2A (1st floor) | No |
| tenant2@condo.local | Kiss Éva | TENANT | 2B (1st floor) | No |

## Units

| Unit | Floor | Ownership Share | Size (m2) |
|------|-------|-----------------|-----------|
| 1A | Ground | 22.00% | 65.50 |
| 1B | Ground | 18.00% | 52.00 |
| 2A | 1st | 22.00% | 65.50 |
| 2B | 1st | 18.00% | 52.00 |
| 3A | 2nd | 20.00% | 78.30 |

## Role Permissions

| Role | Level | Can Access |
|------|-------|------------|
| SUPER_ADMIN | 5 | Everything + promote admins |
| ADMIN | 4 | All modules + user management |
| BOARD_MEMBER | 3 | Finance, voting, announcements, documents (no user mgmt) |
| RESIDENT | 2 | View announcements, forum, maintenance, vote, own finances |
| TENANT | 1 | Same as Resident, restricted financials (own charges only) |
