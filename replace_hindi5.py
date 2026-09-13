import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # HoldModal.tsx
        (r'Blade Wear & Dull Cutters \(ब्लेड घिसाव / धार खत्म\)', r'Blade Wear & Dull Cutters'),
        (r'Die Alignment Error \(डाई अलाइनमेंट मिसमैच\)', r'Die Alignment Error'),
        (r'Paper Feed Jam / Web Slippage \(पेपर फीड जैम\)', r'Paper Feed Jam / Web Slippage'),
        (r'Sensor Fault / Safety Barrier Trip \(ऑप्टिकल/सेफ्टी सेंसर फॉल्ट\)', r'Sensor Fault / Safety Barrier Trip'),
        (r'Motor Overload / Inverter Drive Trip \(मोटर ओवरलोड\)', r'Motor Overload / Inverter Drive Trip'),
        (r'Temperature Deviation \(Mould Heater\) \(तापमान विचलन / हीटर कॉइल\)', r'Temperature Deviation (Mould Heater)'),

        # StockDetailModal.tsx
        (r'Close \(बंद करें\)', r'Close'),

        # PlantManpowerModal.tsx
        (r'लाईव प्लांट मैनपावर एवं हेल्पर ऑडिट \(Live Plant Manpower & Helper Audit\)', r'Live Plant Manpower & Helper Audit'),

        # LiveMaintenanceTracker.tsx
        (r'सभी मशीनें सुचारू रूप से चालू हैं \(All Machines Operational\)', r'All Machines Operational'),
        (r'वर्तमान में प्लांट में कोई एक्टिव ब्रेकडाउन नहीं है। सभी मेंटेनेंस टेक्नीशियन उपलब्ध \(Standby\) हैं।', r'There are no active breakdowns in the plant currently. All maintenance technicians are available (Standby).'),
        (r'वर्तमान में कौन सा टेक्नीशियन किस मशीन पर काम कर रहा है \(Floor Live Traceability\)', r'Which technician is currently working on which machine (Floor Live Traceability)'),
        (r'कार्यरत:', r'Working:'),
        (r'⚠️ कोई टेक्नीशियन नहीं पहुँचा', r'⚠️ No Technician Arrived'),
        (r'रिपेयर पूरा हुआ - मशीन ओके करें', r'Repair Completed - Machine OK'),
        (r'👨‍🔧 मैं अटेंड कर रहा हूँ \(Start Repair\)', r'👨‍🔧 I am Attending (Start Repair)'),
        (r'मेंटेनेंस टीम लाइव स्थिति \(Technician Availability Roster\):', r'Maintenance Team Live Status (Technician Availability Roster):'),
        (r'Available \(उपलब्ध\)', r'Available'),

        # MaterialRequisitionModal.tsx
        (r'Cutting Desk \(कटिंग स्टेशन\)', r'Cutting Desk'),
        (r'Slitting Desk \(स्लिटिंग मशीन\)', r'Slitting Desk'),
        (r'QC Desk \(क्वालिटी इंस्पेक्शन\)', r'QC Desk'),
        (r'Packing Station \(पैकिंग डेस्क\)', r'Packing Station'),
        (r'मटेरियल कैटेगरी \(Item Category\)\*', r'Item Category*'),
        (r'मटेरियल / स्पेयर पार्ट का नाम \(Item Description\)\*', r'Item Description*'),
        (r'उदा\. Band Heater 1500W, BOPP Brown Tape, Cutting Blade, Hydraulic Oil, etc\.', r'e.g. Band Heater 1500W, BOPP Brown Tape, Cutting Blade, Hydraulic Oil, etc.'),
        (r'त्वरित सुझाव:', r'Quick Suggestions:'),
        (r'पार्ट नंबर / स्पेसिफिकेशन \(Part No / Size\)', r'Part No / Size'),
        (r'उदा\. K-Type, 160mm, 280 GSM, 65 Micron', r'e.g. K-Type, 160mm, 280 GSM, 65 Micron'),
        (r'मात्रा \(Required Quantity\)\*', r'Required Quantity*'),
        (r'इकाई \(Unit\)\*', r'Unit*'),
        (r'Pcs / Nos \(नग\)', r'Pcs / Nos'),
        (r'KG \(किलो\)', r'KG'),
        (r'Box / Cartons \(बॉक्सेज\)', r'Box / Cartons'),
        (r'Rolls \(रोल्स\)', r'Rolls'),
        (r'Litre \(लीटर\)', r'Litre'),
        (r'Set \(सेट\)', r'Set'),
        (r'Meters \(मीटर\)', r'Meters'),
        (r'प्राथमिकता / तात्कालिकता \(Urgency Priority\)\*', r'Urgency Priority*'),
        (r'🚨 Emergency / Machine Stopped \(मशीन बंद है - तत्काल चाहिए\)', r'🚨 Emergency / Machine Stopped'),
        (r'⚡ Urgent / Stock Exhausted \(स्टॉक खत्म - 24 घंटे में\)', r'⚡ Urgent / Stock Exhausted (Within 24 Hours)'),
        (r'📦 Normal / Planned Maintenance \(सामान्य - 2-3 दिन\)', r'📦 Normal / Planned Maintenance (2-3 Days)'),
        (r'⏳ Low / Routine Stock Up \(नियमित\)', r'⏳ Low / Routine Stock Up'),
        (r'किस मशीन या काम के लिए चाहिए \(Machine / Purpose\)', r'Machine / Purpose'),
        (r'उदा\. Forming-1 Upper Mould, Slitting Cutter, Dispatch Box', r'e.g. Forming-1 Upper Mould, Slitting Cutter, Dispatch Box'),
        (r'मांगकर्ता का नाम \(Requested By\)\*', r'Requested By*'),
        (r'ऑपरेटर / सुपरवाइजर का नाम', r'Operator / Supervisor Name'),
        (r'विशेष टिप्पणी \(Remarks / Notes\)', r'Remarks / Notes'),
        (r'सप्लायर या मॉडल सम्बन्धी कोई खास निर्देश\.\.\.', r'Any specific supplier or model instructions...'),
        (r'रद्द करें', r'Cancel'),
        (r'सबमिट करें और परचेस को भेजें \(Submit Requisition\)', r'Submit Requisition'),
        (r'मटेरियल, इंडेन्ट नंबर, वेंडर या नाम से खोजें\.\.\.', r'Search by material, indent number, vendor or name...'),
        (r'सभी डिपार्टमेंट \(All Depts\)', r'All Depts'),
        (r'अनुमानित डिलीवरी:', r'Estimated Delivery:'),
        (r'कुल इंडेन्ट्स:', r'Total Indents:'),
        (r'माल आया हुआ:', r'Goods Received:'),
        (r'बंद करें \(Close\)', r'Close'),
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/components/HoldModal.tsx',
    'src/components/StockDetailModal.tsx',
    'src/components/PlantManpowerModal.tsx',
    'src/components/LiveMaintenanceTracker.tsx',
    'src/components/MaterialRequisitionModal.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

