import os

with open('src/components/views/AdminSettingsView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "masterSubTab === 'plans' &&" in line:
        if start_idx == -1:
            start_idx = i
    if "masterSubTab === 'logs' &&" in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    print(f"Found plans section from {start_idx} to {end_idx}")
