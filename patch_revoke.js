const fs = require('fs');
const file = 'src/components/views/AdminSettingsView.tsx';
let code = fs.readFileSync(file, 'utf8');

const mntRightsArray = `    const mntRights = [
      'Maintenance',
      'Mnt_LogIncident',
      'Mnt_AssignTech',
      'Mnt_Repair',
      'Mnt_SpareParts',
      'Mnt_Preventative',
      'Mnt_RCA'
    ];`;

const revokeFunc = `
  const handleRevokeMaintenanceRightsFromUser = (userKey: string) => {
    const u = usersRecord[userKey];
    if (!u) return;
    const mntRights = [
      'Maintenance',
      'Mnt_LogIncident',
      'Mnt_AssignTech',
      'Mnt_Repair',
      'Mnt_SpareParts',
      'Mnt_Preventative',
      'Mnt_RCA'
    ];
    
    // Explicitly prevent removing * (Super Admin) if it's there? Wait, the user might actually just want to remove the specific maintenance rights. If the user has *, they are super admin and have everything. We should just remove the specific rights from the array.
    const existing = u.perms || [];
    const filtered = existing.filter(p => !mntRights.includes(p));
    
    const updatedUsers = {
      ...usersRecord,
      [userKey]: {
        ...u,
        perms: filtered
      }
    };
    onSaveState({
      ...state,
      users: updatedUsers
    });
    if (selectedUserKey === userKey) {
      setEditingUser({ ...editingUser, perms: filtered });
    }
  };
`;

code = code.replace(
  /const handleGrantAllMaintenanceRightsToUser = \(userKey: string\) => \{/,
  revokeFunc.trim() + '\n\n  const handleGrantAllMaintenanceRightsToUser = (userKey: string) => {'
);

const oldUI = `                        {hasMnt ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded">
                            Authorized
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGrantAllMaintenanceRightsToUser(userKey)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded transition cursor-pointer"
                          >
                            + Grant Rights
                          </button>
                        )}`;

const newUI = `                        {hasMnt ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded">
                              Authorized
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRevokeMaintenanceRightsFromUser(userKey)}
                              className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold text-[10px] rounded transition cursor-pointer"
                              title="Revoke Maintenance Rights"
                            >
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGrantAllMaintenanceRightsToUser(userKey)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded transition cursor-pointer"
                          >
                            + Grant Rights
                          </button>
                        )}`;

code = code.replace(oldUI, newUI);
fs.writeFileSync(file, code);
