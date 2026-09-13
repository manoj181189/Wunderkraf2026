import os
filepath = 'src/components/views/SlittingView.tsx'
with open(filepath, 'r') as f: content = f.read()

content = content.replace("machine={selectedMachine || \"Slitting-1\"}", "machine=\"Slitting-1\"")

with open(filepath, 'w') as f: f.write(content)
