-- Drop the "edit_resident_contact" board permission: residents edit their own
-- contact details (profile), so board-side contact editing isn't needed. Also
-- removes any grants of it. Data-only migration (no schema change).
DELETE FROM "UserBuildingPermission"
  WHERE "permissionId" IN (SELECT "id" FROM "BoardPermission" WHERE "key" = 'edit_resident_contact');
DELETE FROM "BoardPermission" WHERE "key" = 'edit_resident_contact';
