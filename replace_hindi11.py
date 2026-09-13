import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # MaintenanceAuditView.tsx
        (r'Step 4: Forming & Thermal Pressing \(फॉर्मिंग मशीन\)', r'Step 4: Forming & Thermal Pressing'),
        (r'Step 3: Cutting & Die-Punching \(कटिंग मशीन\)', r'Step 3: Cutting & Die-Punching'),
        (r'Step 2: Slitting & Reel Conversion \(स्लिटिंग मशीन\)', r'Step 2: Slitting & Reel Conversion'),
        (r'Step 1: Origin Raw Material \(मूल रॉ मटेरियल पेपर - Mother Jumbo Reels\)', r'Step 1: Origin Raw Material (Mother Jumbo Reels)'),
        (r'ग्राहक की शिकायत दर्ज करें, रूट कॉज \(RCA\) पहचानें व समाधान करें', r'Log customer complaint, identify root cause (RCA) and resolve'),
        (r'किसी भी एक बैच का सम्पूर्ण रिपोर्ट जनरेट करें, PDF प्रिंट करें या CSV में डाउनलोड करें', r'Generate full report of any single batch, print PDF or download in CSV'),
        (r'ऑपरेटर व मशीन के सभी टाइमस्टैम्प लॉग्स', r'All timestamp logs of operator and machine'),
        (r'Root Cause Analysis \(RCA - क्यों हुआ\?\)', r'Root Cause Analysis (RCA - Why did it happen?)'),
        (r'Corrective & Preventive Action \(CAPA - सुधारात्मक कदम\)', r'Corrective & Preventive Action (CAPA - Remedial Steps)'),

        # ExecutiveManpowerView.tsx
        (r"hindi: 'योजना',", r"hindi: 'Planning',"),
        (r"hindi: 'स्लिटिंग',", r"hindi: 'Slitting',"),
        (r"hindi: 'कटिंग',", r"hindi: 'Cutting',"),
        (r"hindi: 'फॉर्मिंग',", r"hindi: 'Forming',"),
        (r"hindi: 'क्वालिटी जांच',", r"hindi: 'Quality Check',"),
        (r"hindi: 'डिस्पैच',", r"hindi: 'Dispatch',"),
        (r'Live Machine Crew Allocations \(मशीन व कामगार स्थिति\)', r'Live Machine Crew Allocations'),
        (r'Operator Efficiency \(कामगार दक्षता\)', r'Operator Efficiency'),
        (r'Shift Handover summaries \(शिफ्ट हैंडओवर\)', r'Shift Handover summaries'),
        (r'Raw Material & Wastage analytics \(सामग्री विश्लेषण\)', r'Raw Material & Wastage analytics'),

        # CuttingView.tsx
        (r'// "कटिंग के अंदर एक चीज़ और जोड़ना है जो उसका कटिंग का स्क्रैप निकलेगा। जो कटिंग में से जो एक्स्ट्रा मटेरियल जो स्क्रैप निकलता है, तो स्क्रैप कहां डालना है\? वो पीसेस में से माइनस नहीं होगा। जो रिजेक्ट पीसेस होगा, वही माइनस होगा। दोनों मिक्स ना हो जाए।"', r'// User requirement: Add separate cutting scrap. Extra material scrap from cutting should not minus from pieces. Only reject pieces will minus. Keep them separate.'),
        (r'`✅ कटिंग शिफ्ट हैंडओवर सफलतापूर्वक संपन्न!\\n\\n` \+', r'`✅ Cutting Shift Handover completed successfully!\n\n` +'),
        (r'`निवर्तमान ऑपरेटर \[\$\{batch\.worker\}\] के नाम सुरक्षित रिकॉर्ड:\\n` \+', r'`Outgoing Operator [${batch.worker}] secured record:\n` +'),
        (r'`• पूर्ण क्रेट्स:', r'`• Full Crates:'),
        (r'`• लूज पीस:', r'`• Loose Pieces:'),
        (r'`• कुल तैयार ब्लैंक्स:', r'`• Total Prepared Blanks:'),
        (r'`• रिजेक्शन स्क्रैप:', r'`• Rejection Scrap:'),
        (r'`मशीन \[\$\{selectedMachine\}\] का चालू कार्यभार ऑपरेटर \$\{handoverData\.relievedByOperator\} \(\$\{handoverData\.nextShift\} Shift\)\$\{nextHelpers\.length > 0 \? ` \+ \$\{nextHelpers\.length\} Helpers \(\$\{nextHelpers\.join\(\', \'\}\)\)` : \'\'\} को बिना काम रोके सौंप दिया गया है।`', r'`Ongoing charge of machine [${selectedMachine}] has been handed over to Operator ${handoverData.relievedByOperator} (${handoverData.nextShift} Shift)${nextHelpers.length > 0 ? ` + ${nextHelpers.length} Helpers (${nextHelpers.join(\', \')})` : \'\'} without stopping work.`'),
        (r'// "कटिंग में से जो एक्स्ट्रा मटेरियल जो स्क्रैप निकलता है, तो स्क्रैप कहां डालना है\? वो पीसेस में से माइनस नहीं होगा। जो रिजेक्ट पीसेस होगा, वही माइनस होगा। दोनों मिक्स ना हो जाए।"', r'// See above requirement.'),
        (r'\[अलग से स्क्रैप में जमा, पीसेस में से माइनस नहीं\]', r'[Added separately to scrap, not minus from pieces]'),
        (r'title="ग्लू यूसेज रिकॉर्ड करें"', r'title="Record Glue Usage"'),
        (r'💧 एडहेसिव ग्लू \(Glue Tracker\)', r'💧 Adhesive Glue (Glue Tracker)'),
        (r'title="फ्लोर मैनपावर रोस्टर देखें व बदलें"', r'title="View & Change Floor Manpower Roster"'),
        (r'👥 लाइव मैनपावर \(Floor Roster\)', r'👥 Live Manpower (Floor Roster)'),
        (r'लाइव कटिंग फ्लोर मैनपावर रोस्टर \(Live Station Crew & Floor Manpower\)', r'Live Cutting Floor Manpower Roster (Live Station Crew & Floor Manpower)'),
        (r'बंद करें ✕', r'Close ✕'),
        (r'title="Crew & Helper बदलें / नियुक्त करें"', r'title="Change / Assign Crew & Helper"'),
        (r'क्रू बदलें', r'Change Crew'),
        (r'Adhesive Glue \(ग्लू\):', r'Adhesive Glue:'),
        (r'\+ दर्ज करें', r'+ Record'),
        (r'Click \+ दर्ज करें to record drum', r'Click + Record to record drum'),
        (r'Output Reporting & Scrap/Rejection Counter Deduction \(उत्पादन एवं स्क्रैप कटौती\):', r'Output Reporting & Scrap/Rejection Counter Deduction:'),
        (r'Row 1: Production Additions \(मेन काउंटर में प्लस होने वाली क्वांटिटी\)', r'Row 1: Production Additions (Quantity to be added to main counter)'),
        (r'👥 Crew & Helper पॉप-अप \(Modal\)', r'👥 Crew & Helper Popup (Modal)'),

        # LiveFloorManpowerTracker.tsx
        (r'>बदलें<', r'>Change<'),
        (r'>रद्द करें<', r'>Cancel<')
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/components/views/MaintenanceAuditView.tsx',
    'src/components/views/ExecutiveManpowerView.tsx',
    'src/components/views/CuttingView.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

