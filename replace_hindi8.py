import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # ShiftHandoverModal.tsx
        (r'आने वाली शिफ्ट \(Relieving Shift\):', r'Incoming Shift (Relieving Shift):'),
        (r'अन्य कोई ऑपरेटर \(Type Custom Operator Name if not in list\):', r'Any other operator (Type Custom Operator Name if not in list):'),
        (r'उदा\. RAJESH_CUTTING', r'e.g. RAJESH_CUTTING'),
        (r'इनकमिंग ऑपरेटर के साथ हेल्पर \(Assigned Helpers\):', r'Helpers with incoming operator (Assigned Helpers):'),
        (r'कोई हेल्पर चयनित नहीं \(अकेला ऑपरेटर\)', r'No helper selected (Single operator)'),
        (r'अन्य हेल्पर का नाम लिखकर \+ दबाएँ\.\.\.', r'Type other helper name and press +...'),
        (r'\+ जोड़ें', r'+ Add'),
        (r'<b>हैंडओवर भौतिक सत्यापन स्वीकारोक्ति \(Handover Acceptance\):</b> मैंने मशीन की स्थिति, कच्चा माल और ऑपरेटर', r'<b>Handover Physical Verification Acceptance:</b> I have physically verified the machine condition, raw material and operator'),
        (r'द्वारा तैयार <b>(.*?) क्रेट्स \+ (.*?) लूज पीस \((.*?) कुल पीस\)</b> एवं', r'prepared <b>\1 Crates + \2 Loose Pieces (\3 Total Pieces)</b> and'),
        (r'<b>(.*?) kg स्क्रैप</b> की भौतिक जांच कर ली है और नया कार्यभार ऑपरेटर <b>(.*?)</b> को सुपुर्द कर रहा हूँ।', r'<b>\1 kg scrap</b> and handing over the new charge to operator <b>\2</b>.'),
        (r'\[चयनित ऑपरेटर\]', r'[Selected Operator]'),
        (r'हैंडओवर सुरक्षित करें \(Lock Output & Confirm Handover\)', r'Secure Handover (Lock Output & Confirm Handover)'),
        (r'रद्द करें \(Cancel\)', r'Cancel'),

        # ErrorBoundary.tsx
        (r'एक रनटाइम एरर के कारण स्क्रीन रीसेट हो गई थी। आपका डेटा सुरक्षित है। नीचे दिए गए बटन से तुरंत स्क्रीन वापस लाएं:', r'The screen was reset due to a runtime error. Your data is safe. Restore the screen immediately using the button below:'),

        # LotGenealogyModal.tsx
        (r'Stage-by-Stage Genealogy Chain \(लॉट-टू-लॉट विस्तृत इतिहास\)', r'Stage-by-Stage Genealogy Chain'),
        (r'Slitting Machine \(स्लिटिंग स्टेज\)', r'Slitting Machine (Slitting Stage)'),
        (r'Cutting Machine \(कटिंग स्टेज\)', r'Cutting Machine (Cutting Stage)'),
        (r'Forming Machines \(फॉर्मिंग स्टेज\)', r'Forming Machines (Forming Stage)'),
        (r'Quality Control \(QC स्टेज\)', r'Quality Control (QC Stage)'),
        (r'Packing & Dispatch \(पैकिंग व डिस्पैच\)', r'Packing & Dispatch'),

        # TechnicianAttendModal.tsx
        (r'⚠️ कृपया टेक्नीशियन का नाम चुनें या दर्ज करें।', r'⚠️ Please select or enter the technician name.'),
        (r'📢 \*Status:\* "मेरी साइड से मशीन ओके है - रेडी टू रन!"', r'📢 *Status:* "Machine OK from my side - Ready to Run!"'),
        (r'🟡 Under Repair \(काम चालू\)', r'🟡 Under Repair'),
        (r'🔴 Stopped \(बंद है\)', r'🔴 Stopped'),
        (r'Reason / कारण:', r'Reason:'),
        (r'पर वर्तमान में कोई खुला ब्रेकडाउन टिकट नहीं है।', r'currently has no open breakdown tickets.'),
        (r'यदि मशीन बंद है या मेंटेनेंस की आवश्यकता है, तो नीचे से सीधे अटेंड करें।', r'If the machine is stopped or requires maintenance, attend directly from below.'),
        (r'स्टेप 1: मशीन अटेंड करें \(Technician Reply & Acknowledgment\)', r'Step 1: Attend Machine (Technician Reply & Acknowledgment)'),
        (r'जब आप On Machine पहुँचें, तो तुरंत अपना नाम चुनकर <b>"मैं अटेंड कर रहा हूँ"</b> बटन दबाएं।', r'When you reach On Machine, immediately select your name and press the <b>"I am Attending"</b> button.'),
        (r'इससे ऑपरेटर डेस्क और मेंटेनेंस डैशबोर्ड पर तुरंत दिख जाएगा कि आप इस On Machine काम कर रहे हैं।', r'This will immediately show on the operator desk and maintenance dashboard that you are working on this machine.'),
        (r'टेक्नीशियन का नाम \(Select Technician\):', r'Select Technician:'),
        (r'\+ Other / Custom Name \(अन्य\)', r'+ Other / Custom Name'),
        (r'अन्य टेक्नीशियन का नाम \(Enter Custom Name\):', r'Enter Custom Name:'),
        (r'e\.g\. मुकेश प्रजापति', r'e.g. Mukesh Prajapati'),
        (r'शुरुआती निरीक्षण / नोट्स \(Inspection / Action Note - Optional\):', r'Inspection / Action Note (Optional):'),
        (r'उदा\. हीटर और थर्मोकपल की जांच शुरू की\.\.\.', r'e.g. Started checking heater and thermocouple...'),
        (r'👨‍🔧 मैं इस ब्रेकडाउन को अटेंड कर रहा हूँ \(Start Attending\)', r'👨‍🔧 I am attending this breakdown (Start Attending)'),
        (r'रिपेयरिंग कार्य चालू है \(Under Repair\)', r'Repair work in progress (Under Repair)'),
        (r'👨‍🔧 यह आदमी यहां पर काम कर रहा है:', r'👨‍🔧 This person is working here:'),
        (r'काम शुरू होने का समय:', r'Work Start Time:'),
        (r'\(रिस्पांस टाइम: (.*?) मिनट\)', r'(Response Time: \1 mins)'),
        (r'चालू रिपेयर समय \(Repairing Time\):', r'Ongoing Repair Time:'),
        (r'हीटर एलिमेंट रिप्लेस किया', r'Replaced heater element'),
        (r'थर्मोकपल सेंसर कैलिब्रेट किया', r'Calibrated thermocouple sensor'),

        # LiveFloorManpowerTracker.tsx
        (r'प्रत्येक On Machine मुख्य ऑपरेटर और उसके साथ कार्य कर रहे हेल्परों की सटीक संख्या व नाम', r'Exact number and names of main operator and helpers working with them on each machine'),
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
    'src/components/ShiftHandoverModal.tsx',
    'src/components/ErrorBoundary.tsx',
    'src/components/LotGenealogyModal.tsx',
    'src/components/TechnicianAttendModal.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

