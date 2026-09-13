import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # MachineReadyNotificationModal.tsx
        (r'Later / सिर्फ बंद करें', r'Later / Just Close'),
        (r'मशीन चालू करें \(Resume Run\)', r'Resume Run'),

        # BatchReportModal.tsx
        (r'Batch Initialized \(प्रारंभिक चरण\)', r'Batch Initialized'),
        (r'Dispatched & Delivered \(डिस्पैच पूर्ण\)', r'Dispatched & Delivered'),
        (r'Stage 5: Packed & Sealed \(पैकिंग पूर्ण - डिस्पैच हेतु तैयार\)', r'Stage 5: Packed & Sealed (Ready for Dispatch)'),
        (r'Stage 4: QC Approved \(क्यू\.सी\. पास - पैकिंग हेतु तैयार\)', r'Stage 4: QC Approved (Ready for Packing)'),
        (r'Stage 3: Forming In-Progress \(फॉर्मिंग मशीन पर कार्य चालू\)', r'Stage 3: Forming In-Progress'),
        (r'Stage 3: Forming Done • QC Pending \(फॉर्मिंग पूर्ण - क्यू\.सी\. बाकी\)', r'Stage 3: Forming Done • QC Pending'),
        (r'Stage 2: Cutting In-Progress \(कटिंग मशीन पर कार्य चालू\)', r'Stage 2: Cutting In-Progress'),
        (r'Stage 2: Cutting Done • Forming Pending \(कटिंग पूर्ण - फॉर्मिंग बाकी\)', r'Stage 2: Cutting Done • Forming Pending'),
        (r'Stage 1: Slitting Completed • Awaiting Cutting \(केवल स्लिटिंग हुई है - कटिंग पेंडिंग\)', r'Stage 1: Slitting Completed • Awaiting Cutting'),
        (r'Pending Inspection \(क्यू\.सी\. पेंडिंग\)', r'Pending Inspection'),
        (r'⏳ PENDING \(प्रक्रिया बाकी\)', r'⏳ PENDING'),
        (r'⏳ PENDING INSPECTION \(निरीक्षण बाकी\)', r'⏳ PENDING INSPECTION'),
        (r'⏳ PENDING \(पैकिंग बाकी\)', r'⏳ PENDING'),
        (r'लाइव उत्पादन प्रोग्रेस, वास्तविक एंट्री अनुसार स्टेज ट्रैकिंग', r'Live Production Progress, Stage Tracking as per actual entry'),
        (r'1\. Production Stage Telemetry & Audit Chain \(चरणबद्ध उत्पादन विवरण\)', r'1. Production Stage Telemetry & Audit Chain'),
        (r'\* केवल वही चरण स्वीकृत दिखेंगे जिनकी ऑपरेटर द्वारा वास्तविक एंट्री सबमिट हुई है', r'* Only approved stages where operator has submitted actual entry will be shown'),
        (r'Stage \(चरण\)', r'Stage'),
        (r'Machine \(मशीन\)', r'Machine'),
        (r'Operator \(ऑपरेटर\)', r'Operator'),
        (r'Shift & Time \(शिफ्ट/समय\)', r'Shift & Time'),
        (r'Inputs & Output Recorded \(मात्रा विवरण\)', r'Inputs & Output Recorded'),
        (r'Stage Status \(स्थिति\)', r'Stage Status'),
        (r'1\. Slitting \(स्लिटिंग\)', r'1. Slitting'),
        (r'स्लिटिंग अभी शुरू नहीं हुई', r'Slitting not started yet'),
        (r'2\. Cutting \(कटिंग\)', r'2. Cutting'),
        (r'मशीन पर कटिंग चालू है \(In Progress\)', r'Cutting is Running (In Progress)'),
        (r'कटिंग की एंट्री अभी नहीं हुई है \(Not Started\)', r'Cutting entry not done yet (Not Started)'),
        (r'3\. Forming \(फॉर्मिंग\)', r'3. Forming'),
        (r'फॉर्मिंग प्रेस पर कार्य चालू है \(In Progress\)', r'Forming Press is Running (In Progress)'),
        (r'फॉर्मिंग की एंट्री अभी नहीं हुई है \(Not Started\)', r'Forming entry not done yet (Not Started)'),
        (r'4\. QC Inspection \(गुणवत्ता जांच\)', r'4. QC Inspection'),
        (r'क्यू\.सी\. निरीक्षण अभी बाकी है \(Pending QC Audit\)', r'QC Inspection Pending (Pending QC Audit)'),
        (r'5\. Packing \(पैकिंग व बॉक्सिंग\)', r'5. Packing'),
        (r'पैकिंग लाइन पर अभी नहीं पहुंचा \(Pending Packing\)', r'Not reached packing line yet (Pending Packing)'),
        (r'6\. Dispatch \(डिस्पैच व इनवॉइस\)', r'6. Dispatch'),
        (r'फैक्ट्री वेयरहाउस में सुरक्षित \(Ready in Warehouse\)', r'Safe in Factory Warehouse (Ready in Warehouse)'),
        (r'निरीक्षण के बाद ही साइन होगा', r'Will be signed only after inspection'),
        (r'बैच प्रक्रियाधीन है', r'Batch is in progress'),

        # LoginView.tsx
        (r'सुरक्षा प्रतिबंध \(Login Required Policy\):', r'Login Required Policy:'),
        (r'Login के बिना Voice AI Floor Dictation, Google Search Grounding या कोई भी फ्लोर स्क्रीन डायरेक्ट एक्सेस नहीं हो सकती।', r'Voice AI Floor Dictation, Google Search Grounding, or any floor screen cannot be directly accessed without Login.'),
        (r'Workstation Username \(ऑपरेटर आईडी\)', r'Workstation Username'),
        (r'Private Access Password \(पासवर्ड\)', r'Private Access Password'),
        (r'अमान्य लॉगिन! गलत यूजरनेम या पासवर्ड। कृपया दोबारा प्रयास करें।', r'Invalid login! Incorrect username or password. Please try again.'),
        (r'Login & Open Floor Hub \(लॉगिन करें\)', r'Login & Open Floor Hub'),

        # CustomSparePartModal.tsx
        (r'⚠️ कृपया स्पेयर पार्ट का नाम दर्ज करें \(Please enter spare part name\)', r'⚠️ Please enter spare part name'),
        
        # NavigationHub.tsx
        (r'दैनिक प्रेरणा कविता', r'Daily Factory Inspiration Poem')
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/components/MachineReadyNotificationModal.tsx',
    'src/components/BatchReportModal.tsx',
    'src/components/LoginView.tsx',
    'src/components/CustomSparePartModal.tsx',
    'src/components/NavigationHub.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

