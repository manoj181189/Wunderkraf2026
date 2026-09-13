import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # LiveFloorManpowerTracker.tsx
        (r'हेल्पर असाइनमेंट \(', r'Helper Assignment ('),
        (r'ऑपरेटर:', r'Operator:'),
        (r'इस ऑपरेटर के साथ नियुक्त हेल्पर \(', r'Assigned Helpers with this Operator ('),
        (r'कोई हेल्पर नहीं', r'No Helper'),
        (r'हेल्पर का नाम लिखें \(उदा\. SUNIL_HELPER\)\.\.\.', r'Write Helper Name (e.g. SUNIL_HELPER)...'),
        (r'\+ जोड़ें', r'+ Add'),
        (r'उपलब्ध हेल्पर \(Quick Pick\):', r'Available Helpers (Quick Pick):'),
        (r'सुरक्षित करें \(Save Allocation\)', r'Save Allocation'),
        (r'\+ नया फ्लोर वर्कर / हेल्पर जोड़ें', r'+ Add New Floor Worker / Helper'),
        (r'नया ऑपरेटर, हेल्पर या सुपरवाइजर मास्टर रोस्टर में दर्ज करें', r'Enter new operator, helper, or supervisor in the master roster'),
        (r'कर्मचारी का नाम \(Worker Name\) \*:', r'Worker Name *:'),
        (r'उदा\. SUNIL_HELPER', r'e.g. SUNIL_HELPER'),
        (r'पद \(Role\) \*:', r'Role *:'),
        (r'हेल्पर \(Helper\)', r'Helper'),
        (r'ऑपरेटर \(Operator\)', r'Operator'),
        (r'सुपरवाइजर \(Supervisor\)', r'Supervisor'),
        (r'क्यूसी इंस्पेक्टर \(QC\)', r'QC Inspector'),
        (r'मेंटेनेंस \(Maintenance\)', r'Maintenance'),
        (r'विभाग \(Dept\):', r'Department (Dept):'),
        (r'शिफ्ट \(Shift\):', r'Shift:'),
        (r'आवंटित मशीन:', r'Assigned Machine:'),
        (r'उदा\. Cutting-1', r'e.g. Cutting-1'),
        (r'किस ऑपरेटर के साथ नियुक्त है \(Paired With Operator\):', r'Paired With Operator:'),
        (r'उदा\. CUT_OP1', r'e.g. CUT_OP1'),
        (r'\+ वर्कर सेव करें', r'+ Save Worker'),
        (r'>रद्द करें<', r'>Cancel<'),

        # AttendingTechnicianModal.tsx
        (r'⚠️ कृपया अटेंड करने वाले मेंटेनेंस मैनेजर या टेक्नीशियन का नाम चुनें!', r'⚠️ Please select the name of the attending maintenance manager or technician!'),
        (r'अटेंड ब्रेकडाउन \(Attend Breakdown\)', r'Attend Breakdown'),
        (r'मशीन:', r'Machine:'),
        (r'रिपोर्ट की गई खराबी \(Reported Fault\):', r'Reported Fault:'),
        (r'अटेंड करने वाले मेंटेनेंस मैनेजर / इंजीनियर का नाम चुनें: \*', r'Select Attending Maintenance Manager / Engineer Name: *'),
        (r'अनिवार्य \(Required\)', r'Required'),
        (r'या कोई अन्य नाम / एक्सटर्नल वेंडर \(Or Type Custom Name\):', r'Or Type Custom Name / External Vendor:'),
        (r'उदा\. Sanjay Patel \(Maintenance Lead\) या वेंडर नाम', r'e.g. Sanjay Patel (Maintenance Lead) or Vendor Name'),
        (r'शुरुआती निरीक्षण नोट \(Initial Inspection Note - Optional\):', r'Initial Inspection Note (Optional):'),
        (r'उदा\. हीटर और मोटर का वोल्टेज चेक करना शुरू किया\.\.\.', r'e.g. Started checking heater and motor voltage...'),
        (r'डैशबोर्ड पर यह नाम दिखेगा \(Will display on dashboard\):', r'Will display on dashboard:'),
        (r'"यह आदमी यहां पर काम कर रहा है" स्थिति तुरंत चालू होगी।', r'"This person is working here" status will be activated immediately.'),
        (r'रद्द करें \(Cancel\)', r'Cancel'),
        (r'👨‍🔧 मैं काम शुरू कर रहा हूँ \(Confirm Attend\)', r'👨‍🔧 I am starting work (Confirm Attend)'),

        # MaterialRequisitionModal.tsx
        (r'कृपया मटेरियल या स्पेयर पार्ट का नाम दर्ज करें \(Item name required\)', r'Please enter material or spare part name (Item name required)'),
        (r'इंडेन्ट सिस्टम', r'Indent System'),
        (r'किसी भी प्लांट डेस्क से तुरंत मटेरियल व स्पेयर पार्ट डिमांड भेजें और लाइव आगमन ट्रैक करें', r'Instantly send material and spare part demand from any plant desk and track live arrival'),
        (r'🎉 <strong>(.*?) मटेरियल स्टोर में आ चुका है!</strong> \(Ready for collection at Factory Store\)', r'🎉 <strong>\1 Material has arrived in the store!</strong> (Ready for collection at Factory Store)'),
        (r'देखें कौन सा माल आया है →', r'See what goods have arrived →'),
        (r'1\. नया इंडेन्ट भरें \(Raise Requisition\)', r'1. Raise Requisition'),
        (r'2\. मेरे इंडेन्ट्स व माल आगमन स्थिति \(Live Status\)', r'2. My Indents & Goods Arrival (Live Status)'),
        (r'परचेस डिपार्टमेंट डेस्क खोलें', r'Open Purchase Department Desk'),
        (r'डिपार्टमेंट / मशीन डेस्क \(Department\)\*', r'Department / Machine Desk*'),
        (r'Maintenance \(मेंटेनेंस / टूलींग\)', r'Maintenance / Tooling'),
        (r'Forming Desk \(फॉर्मिंग मशीन\)', r'Forming Desk'),

        # LiveMaintenanceTracker.tsx
        (r'कौन फ्री है, कौन बिजी है', r'Who is free, who is busy')
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/components/LiveFloorManpowerTracker.tsx',
    'src/components/AttendingTechnicianModal.tsx',
    'src/components/MaterialRequisitionModal.tsx',
    'src/components/LiveMaintenanceTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

