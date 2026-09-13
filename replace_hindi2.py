import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # CustomSparePartModal.tsx
        (r'नया कस्टम स्पेयर पार्ट दर्ज करें \(Add Custom Spare Part\)', r'Add Custom Spare Part'),
        (r'नया स्पेयर पार्ट का नाम, मात्रा व विवरण टाइप करें', r'Type new spare part name, quantity, and description'),
        (r'स्पेयर पार्ट का नाम \(Spare Part Name\): \*', r'Spare Part Name: *'),
        (r'अनिवार्य \(Required\)', r'Required'),
        (r'उदा\. Brass Bush 32mm / Heater Coil 2000W / Cutter Blade 160mm', r'e.g. Brass Bush 32mm / Heater Coil 2000W / Cutter Blade 160mm'),
        (r'जो पार्ट लिस्ट में नहीं मिल रहा है, उसका सटीक नाम यहाँ लिखें', r'Write the exact name of the part that is not in the list here'),
        (r'कैटेगरी / विभाग \(Category\):', r'Category / Department:'),
        (r'संख्या / मात्रा \(Qty\): \*', r'Quantity (Qty): *'),
        (r'इकाई \(Unit\):', r'Unit:'),
        (r'पार्ट नंबर / स्पेसिफिकेशन / नोट्स \(Part No\. / Specs - Optional\):', r'Part No. / Specs - Optional:'),
        (r'उदा\. Model: Festo 24V DC / Size: 160mm x 25mm / Bin #B-04', r'e.g. Model: Festo 24V DC / Size: 160mm x 25mm / Bin #B-04'),
        (r'रद्द करें \(Cancel\)', r'Cancel'),
        (r'✅ यह स्पेयर पार्ट जोड़ें \(Add to List\)', r'✅ Add this spare part (Add to List)'),

        # NavigationHub.tsx
        (r'मेहनत और लगन से हर रोल को नया रूप हम देते हैं,', r'With hard work and dedication, we give a new shape to every roll,'),
        (r'सटीक माप और शुद्ध गुणवत्ता से कारखाने का मान बढ़ाते हैं।', r'We increase the factory\'s pride with exact measurements and pure quality.'),
        (r'हर चम्मच, हर कांटा, हर पैक में है विश्वास हमारा,', r'In every spoon, every fork, every pack lies our trust,'),
        (r'वंडरक्राफ की शान है हर कामगार का पसीना प्यारा।', r'Every worker\'s dear sweat is the pride of Wondercraft.'),
        (r'मशीन व ऑपरेटर रिपोर्ट', r'Machine & Operator Report'),
        (r'माल प्राप्ति', r'Goods Received'),
        (r'दैनिक प्रेरणा कविता \(Factory Floor Inspiration\)', r'Factory Floor Inspiration Poem'),
        (r'कविता अपडेट करें \(Edit Poem\)', r'Edit Poem'),
        (r'सेव करें \(Save\)', r'Save'),
        (r'रद्द करें', r'Cancel'),
        (r'मूल कविता', r'Original Poem'),
        (r'यहाँ अपनी पसंदीदा प्रेरणादायक कविता या कारखाना संदेश लिखें...', r'Write your favorite inspirational poem or factory message here...'),
        (r'Material Indent \(इंडेन्ट\)', r'Material Indent'),
        (r'मटेरियल व स्पेयर डिमांड ट्रैक करें', r'Track Material & Spare Demands'),
        (r'Floor Manpower \(मैनपावर\)', r'Floor Manpower Tracker'),
        (r'ऑपरेटर, 2-हेल्पर व मशीन आवंटन', r'Operator, 2-Helper & Machine Allocation'),
        (r'लाइव उत्पादन प्रगति: स्लिटिंग ➔ कटिंग ➔ फॉर्मिंग ➔ क्यूसी ➔ पैकिंग \(क्लिक करके सीधे डेस्क पर जाएँ\)', r'Live Production Progress: Slitting ➔ Cutting ➔ Forming ➔ QC ➔ Packing (Click to go direct)'),
        (r'hindi: \'स्लिटिंग\',', r"hindi: 'Slitting',"),
        (r'hindi: \'कटिंग\',', r"hindi: 'Cutting',"),
        (r'hindi: \'फॉर्मिंग\',', r"hindi: 'Forming',"),
        (r'hindi: \'क्वालिटी जांच\',', r"hindi: 'QC Inspection',"),
        (r'hindi: \'बॉक्स पैकिंग\',', r"hindi: 'Box Packing',"),

        # GlueUsageModal.tsx
        (r'एडहेसिव ग्लू यूज़ एंट्री', r'Adhesive Glue Usage Entry'),
        (r'ग्लू ब्रांड \(Adhesive Glue Brand\) \*', r'Adhesive Glue Brand *'),
        (r'ग्लू मात्रा \(Quantity in KG / Litres\) \*', r'Glue Quantity (KG / Litres) *'),
        (r'शिफ्ट \(Shift\) \*', r'Shift *'),
        (r'मशीन \(Station / Machine\) \*', r'Machine / Station *'),
        (r'डिपार्टमेंट / स्टेज \(Department\) \*', r'Department / Stage *'),
        (r'Cutting Desk \(कटिंग\)', r'Cutting Desk'),
        (r'Forming Desk \(फॉर्मिंग\)', r'Forming Desk'),
        (r'Slitting Desk \(स्लिटिंग\)', r'Slitting Desk'),
        (r'Packing Station \(पैकिंग\)', r'Packing Station'),
        (r'ऑपरेटर / यूजर \(Operator Name\) \*', r'Operator Name *'),
        (r'ड्रम / लॉट नंबर \(Drum / Lot No\.\)', r'Drum / Lot No.'),
        (r'जॉब आईडी \(Job ID - Optional\)', r'Job ID (Optional)'),
        (r'बैच आईडी \(Batch ID - Optional\)', r'Batch ID (Optional)'),
        (r'उपयोग विवरण / टिप्पणी \(Purpose / Remarks\)', r'Purpose / Remarks'),
        (r'ग्लू यूज़ दर्ज करें \(Save Entry\)', r'Save Glue Usage Entry'),

        # MachineBreakdownBanner.tsx
        (r'🟡 REPAIR IN PROGRESS • काम चालू है', r'🟡 REPAIR IN PROGRESS'),
        (r'\(⏱️ (.*?) मिनट से काम जारी है\)', r'(⏱️ Work in progress for \1 minutes)'),
        (r'कुल बंद Time:', r'Total Down Time:'),
        (r'रिपेयर पूरा हुआ - मशीन ओके करें', r'Repair Completed - Mark Machine OK'),
        (r'समस्या \(Reason\):', r'Issue (Reason):'),
        (r'मशीन ठीक होते ही ऊपर दिए गए बटन से "रिपेयर पूरा हुआ" दर्ज करें।', r'As soon as the machine is fixed, click "Repair Completed" above.'),
        (r'🔴 BREAKDOWN • मशीन बंद है', r'🔴 BREAKDOWN'),
        (r'\(टेक्नीशियन का इंतज़ार • (.*?) मिनट से बंद\)', r'(Waiting for Technician • Down for \1 minutes)'),
        (r'कारण:', r'Reason:')
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/components/CustomSparePartModal.tsx',
    'src/components/NavigationHub.tsx',
    'src/components/GlueUsageModal.tsx',
    'src/components/MachineBreakdownBanner.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

