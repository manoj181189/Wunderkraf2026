import os

filepath = 'src/types.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add to ProductionPlan specifically
if "plainLayersCount?: number;" not in content[content.find("export interface ProductionPlan {"):]:
    content = content.replace(
        "export interface ProductionPlan {",
        "export interface ProductionPlan {\n  printedLayersCount?: number;\n  plainLayersCount?: number;"
    )

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed types")
