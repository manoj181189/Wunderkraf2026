import os
filepath = 'src/types.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "  printedRollIcon?: string;\n}",
    "  printedRollIcon?: string;\n  printedLayersCount?: number;\n  plainLayersCount?: number;\n}"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
