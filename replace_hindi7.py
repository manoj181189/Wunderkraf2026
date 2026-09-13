import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # TechnicianAttendModal.tsx
        (r'सेंसर साफ किया और कैलिब्रेट किया', r'Cleaned and calibrated sensor'),
        (r'ब्लेड शार्प और री-अलाइन किया', r'Sharpened and realigned blade'),
        (r'टेफ्लॉन टेप चेंज किया', r'Changed Teflon tape'),
        (r'न्यूमेटिक प्रेशर और वॉल्व ट्यून किया', r'Tuned pneumatic pressure and valve'),
        (r'बदले गए स्पेयर पार्ट्स \(Spare Parts Replaced\):', r'Spare Parts Replaced:'),
        (r'➕ कस्टम पार्ट पॉप-अप', r'➕ Custom Part Popup'),
        (r'📋 लिस्ट से चुनें', r'📋 Choose from List'),
        (r'✍️ सीधे नाम टाइप करें', r'✍️ Type Name Directly'),
        (r'स्पेयर पार्ट का नाम टाइप करें \(उदा\. Brass Bush 32mm\)\.\.\.', r'Type spare part name (e.g. Brass Bush 32mm)...'),
        (r'➕ नया कस्टम पार्ट लिखें \(Type Custom Part\)\.\.\.', r'➕ Type Custom Part...'),
        (r'📲 ऑपरेटर / फ्लोर हेड को व्हाट्सएप पर "रेडी टू रन" मैसेज भेजें', r'📲 Send "Ready to Run" WhatsApp message to Operator / Floor Head'),
        (r'कुल डाउनटाइम: <b>(.*?) मिनट</b> \| रिपेयर समय: <b>(.*?) मिनट</b>', r'Total Downtime: <b>\1 mins</b> | Repair Time: <b>\2 mins</b>'),
        (r'✅ मेरी साइड से ओके है - रिपेयर पूरा हुआ \(Handover & Set Machine Running\)', r'✅ Machine OK from my side - Repair Completed (Handover & Set Machine Running)'),

        # LiveFloorManpowerTracker.tsx
        (r'लाईव प्लांट मैनपावर व हेल्पर ट्रैकर \(Live Floor Workforce Tracker\)', r'Live Floor Workforce Tracker'),
        (r'वर्तमान में फ्लोर पर कुल कार्यरत ऑपरेटर्स, प्रत्येक ऑपरेटर के साथ नियुक्त हेल्पर, सुपरवाइजर व मेंटेनेंस टीम', r'Total operators currently working on the floor, assigned helpers with each operator, supervisor & maintenance team'),
        (r'\+ नया वर्कर / हेल्पर जोड़ें', r'+ Add New Worker / Helper'),
        (r'WhatsApp रिपोर्ट', r'WhatsApp Report'),
        (r'कुल कार्यरत व्यक्ति \(Total On Floor\)', r'Total On Floor'),
        (r'वर्कर एक्टिव', r'Worker Active'),
        (r'ऑपरेटर्स \(Operators\)', r'Operators'),
        (r'मशीन पर', r'On Machine'),
        (r'हेल्पर \(Helpers\)', r'Helpers'),
        (r'पेयर्ड', r'Paired'),
        (r'क्यूसी \(QC Team\)', r'QC Team'),
        (r'इंस्पेक्टर', r'Inspector'),
        (r'सुपरवाइजर \+ मेंटेनेंस', r'Supervisor + Maintenance'),
        (r'स्टेशनवार ऑपरेटर एवं नियुक्त हेल्पर सूची \(Station-wise Operator & Helpers Allocation\)', r'Station-wise Operator & Helpers Allocation'),
        (r'प्रत्येक मशीन पर मुख्य ऑपरेटर और उसके साथ कार्य कर रहे हेल्परों की सटीक संख्या व नाम', r'Exact number and names of main operator and helpers working with them on each machine'),
        (r'(.*?) सक्रिय वर्कस्टेशन', r'\1 Active Workstations'),
        (r'मुख्य Operator:', r'Main Operator:'),
        (r'नियुक्त हेल्पर \(', r'Assigned Helpers ('),
        (r'>बदलें<', r'>Change<'),
        (r'No Helper \(अकेला ऑपरेटर\)', r'No Helper (Single Operator)'),
        (r'फ्लोर मैनपावर हाजिरी व मास्टर रोस्टर \(Workforce Attendance & Roster\)', r'Workforce Attendance & Roster'),
        (r'उपस्थिति बदलने के लिए टॉगल बटन दबाएँ \(Click present badge to toggle attendance\)', r'Click present badge to toggle attendance'),
        (r'खोजें \(नाम, मशीन, ऑपरेटर\)\.\.\.', r'Search (name, machine, operator)...'),
        (r'सभी विभाग \(All Depts\)', r'All Depts'),
        (r'सभी पद \(All Roles\)', r'All Roles'),
        (r'ऑपरेटर्स \(Operators\)', r'Operators'),
        (r'हेल्पर \(Helpers\)', r'Helpers'),
        (r'सुपरवाइजर \(Supervisors\)', r'Supervisors'),
        (r'क्यूसी \(QC Inspectors\)', r'QC Inspectors'),
        (r'कर्मचारी नाम \(Worker Name\)', r'Worker Name'),
        (r'पद \(Role\)', r'Role'),
        (r'विभाग \(Department\)', r'Department'),
        (r'आवंटित स्टेशन / ऑपरेटर \(Station / Paired Op\)', r'Station / Paired Op'),
        (r'शिफ्ट \(Shift\)', r'Shift'),
        (r'आने का समय \(In-Time\)', r'In-Time'),
        (r'उपस्थिति स्थिति \(Status\)', r'Status'),
        (r'कोई कर्मचारी नहीं मिला \(No workers matched the filter\)', r'No workers matched the filter'),
        (r'● उपस्थित \(Present\)', r'● Present'),
        (r'○ अनुपस्थित \(Absent\)', r'○ Absent'),
        (r'>रद्द करें<', r'>Cancel<')
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/components/TechnicianAttendModal.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

