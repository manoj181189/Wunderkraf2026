import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # whatsappReports.ts
        (r'☀️ DAY SHIFT \(डे शिफ्ट\)', r'☀️ DAY SHIFT'),
        (r'🌙 NIGHT SHIFT \(नाईट शिफ्ट\)', r'🌙 NIGHT SHIFT'),

        # productionAudit.ts
        (r'All Factory Machines \(संपूर्ण फ्लीट\)', r'All Factory Machines'),
        (r'All Operators \(सभी ऑपरेटर\)', r'All Operators'),

        # SlittingView.tsx
        (r'⚠️ सिंगल एक्टिव जॉब प्रतिबंध \(Single Active Job Constraint\):\\n\\nमशीन \[Slitting-1\] पर पहले से जॉब \[\$\{currentRunningBatch\.job\.id\}\] \(रील: \$\{currentRunningBatch\.batch\.reelNo \|\| currentRunningBatch\.job\.reelNo\}\) रनिंग स्थिति में है!\\n\\nएक मशीन पर एक समय में केवल एक ही एक्टिव जॉब चल सकता है। जब तक वर्तमान जॉब को \'Hold\' या \'Complete\' नहीं किया जाता, तब तक उसी मशीन पर कोई भी नया जॉब स्टार्ट \(Run\) नहीं होना चाहिए।\\n\\n👉 अगर इसी जॉब में अतिरिक्त रील जोड़नी है, तो \'Add Reel to Running Job\' विकल्प का उपयोग करें \(बिना जॉब रोके/होल्ड किए\)।', r'⚠️ Single Active Job Constraint:\n\nJob [${currentRunningBatch.job.id}] (Reel: ${currentRunningBatch.batch.reelNo || currentRunningBatch.job.reelNo}) is already running on machine [Slitting-1]!\n\nOnly one active job can run on a machine at a time. Until the current job is Held or Completed, no new job should be started (Run) on that machine.\n\n👉 If you need to add an extra reel to this same job, use the \'Add Reel to Running Job\' option (without stopping/holding the job).'),
        (r'⚠️ सिंगल एक्टिव जॉब प्रतिबंध \(Single Active Job Constraint\):\\n\\nमशीन \[Slitting-1\] पर अभी जॉब \[\$\{currentRunningBatch\.job\.id\}\] रनिंग है! आप केवल इसी एक्टिव जॉब \[\$\{currentRunningBatch\.job\.id\}\] में अतिरिक्त रील Add-on कर सकते हैं।\\n\\nकिसी अन्य जॉब \[\$\{targetJob\.id\}\] को रन करने के लिए पहले वर्तमान जॉब को \'Hold\' या \'Complete\' करें!', r'⚠️ Single Active Job Constraint:\n\nJob [${currentRunningBatch.job.id}] is currently running on machine [Slitting-1]! You can only add-on extra reels to this active job [${currentRunningBatch.job.id}].\n\nTo run another job [${targetJob.id}], first Hold or Complete the current job!'),
        (r'⚠️ सिंगल एक्टिव जॉब प्रतिबंध \(Single Active Job Constraint\):\\n\\nमशीन \[Slitting-1\] पर पहले से जॉब \[\$\{otherRunning\.job\.id\}\] \(रील: \$\{otherRunning\.batch\.reelNo \|\| otherRunning\.job\.reelNo\}\) रनिंग स्थिति में है!\\n\\nएक समय में केवल एक ही जॉब रन हो सकता है। कृपया पहले जॉब \[\$\{otherRunning\.job\.id\}\] को Hold या Finish करें!', r'⚠️ Single Active Job Constraint:\n\nJob [${otherRunning.job.id}] (Reel: ${otherRunning.batch.reelNo || otherRunning.job.reelNo}) is already running on machine [Slitting-1]!\n\nOnly one job can run at a time. Please Hold or Finish job [${otherRunning.job.id}] first!'),
        (r'⛔ भौतिक रूप से असंभव \(Physical Impossibility Error\)!', r'⛔ Physical Impossibility Error!'),
        (r'⛔ वजन असंतुलन \(Weight Balance Error\)!\n\n', r'⛔ Weight Balance Error!\n\n'),
        (r'आउटपुट वजन \(\$\{weightKg\} KG\) \+ वेस्टेज स्क्रैप \(\$\{finalScrapKg\} KG\) = \$\{\(weightKg \+ finalScrapKg\)\.toFixed\(1\)\} KG\n', r'Output Weight (${weightKg} KG) + Wastage Scrap (${finalScrapKg} KG) = ${(weightKg + finalScrapKg).toFixed(1)} KG\n'),
        (r'यह कुल इनपुट वजन \(\$\{inputWeight\} KG\) से अधिक है!\n\n', r'This is greater than total input weight (${inputWeight} KG)!\n\n'),

        # LiveFloorManpowerTracker.tsx
        (r'>बदलें<', r'>Change<')
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/lib/whatsappReports.ts',
    'src/lib/productionAudit.ts',
    'src/components/views/SlittingView.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

