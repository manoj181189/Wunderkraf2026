import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # PurchaseView.tsx
        (r'मांगकर्ता: <span className="font-semibold text-slate-800">', r'Requested By: <span className="font-semibold text-slate-800">'),
        (r'मांगी गई मात्रा:', r'Requested Qty:'),
        (r'सप्लायर/वेंडर: <strong>', r'Supplier/Vendor: <strong>'),
        (r'PO नंबर: <strong className="font-mono text-blue-700">', r'PO Number: <strong className="font-mono text-blue-700">'),
        (r'अनुमानित डिलीवरी: <strong>', r'Estimated Delivery: <strong>'),
        (r'लागत: <strong>', r'Cost: <strong>'),
        (r'परचेस नोट:', r'Purchase Note:'),
        (r'माल स्टोर में उपलब्ध है', r'Goods available in store'),
        (r'लोकेशन: <strong>', r'Location: <strong>'),
        (r'प्राप्ति: <strong>', r'Received: <strong>'),
        (r'\| मात्रा: <strong>', r'| Qty: <strong>'),
        (r'GRN / इनवॉइस: <strong>', r'GRN / Invoice: <strong>'),
        (r'\| जमाकर्ता: <strong>', r'| Deposited By: <strong>'),
        (r'डिपार्टमेंट द्वारा प्राप्त किया गया', r'Received by Department'),
        (r'⏳ फ्लोर द्वारा उठाना बाकी', r'⏳ Pending pickup by floor'),
        (r'परचेस कार्यवाही:', r'Purchase Action:'),
        (r'PO अपडेट करें', r'Update PO'),
        (r'PO / ऑर्डर जारी करें', r'Issue PO / Order'),
        (r'माल आ गया है \(Mark Received\)', r'Goods Arrived (Mark Received)'),
        (r'WhatsApp सूचना भेजें', r'Send WhatsApp Notification'),
        (r'वेंडर को PO / ऑर्डर जारी करें', r'Issue PO / Order to Vendor'),
        (r'वेंडर / सप्लायर का नाम \(Vendor Name\)\*', r'Vendor / Supplier Name*'),
        (r'उदा\. Shreeji Electricals, Apex Packaging, JK Paper, आदि', r'e.g. Shreeji Electricals, Apex Packaging, JK Paper, etc.'),
        (r'PO नंबर \(Purchase Order No\)\*', r'PO Number (Purchase Order No)*'),
        (r'अनुमानित डिलीवरी डेट \(Expected Date\)\*', r'Expected Delivery Date*'),
        (r'अनुमानित कुल लागत \(Est Cost ₹\)', r'Estimated Total Cost (Est Cost ₹)'),
        (r'परचेस रिमार्क / डिलीवरी शर्तें', r'Purchase Remarks / Delivery Terms'),
        (r'उदा\. अर्जेंट डिलीवरी, कोरियर द्वारा', r'e.g. Urgent delivery, by courier'),
        (r'रद्द करें', r'Cancel'),
        (r'ऑर्डर व PO सबमिट करें \(Confirm PO\)', r'Submit Order & PO (Confirm PO)'),
        (r'माल प्राप्ति दर्ज करें \(Goods Received Note - GRN\)', r'Enter Goods Receipt (Goods Received Note - GRN)'),
        (r'यह सबमिट करते ही (.*?) डेस्क को तुरंत सूचना मिल जाएगी कि मटेरियल स्टोर में आ गया है!', r'Upon submitting, the \1 desk will immediately be notified that the material has arrived in the store!'),
        (r'इंडेन्ट: <strong>', r'Indent: <strong>'),
        (r'\| डिपार्टमेंट: <strong>', r'| Department: <strong>'),
        (r'\| मांगकर्ता: <strong>', r'| Requested By: <strong>'),
        (r'प्राप्त मात्रा \(Received Qty\)\*', r'Received Qty*'),
        (r'GRN नं / सप्लायर बिल नं \(Bill No\)', r'GRN No / Supplier Bill No'),
        (r'उदा\. GRN-2026-095', r'e.g. GRN-2026-095'),
        (r'स्टोर लोकेशन / बिन रैक \(Storage Location / Rack Bin\)\*', r'Store Location / Rack Bin*'),
        (r'उदा\. Maintenance Tool Crib Rack B2, Main Chemical Store Shelf 3', r'e.g. Maintenance Tool Crib Rack B2, Main Chemical Store Shelf 3'),
        (r'सामग्री प्राप्तकर्ता \(Received By Store Incharge\)\*', r'Received By Store Incharge*'),
        (r'✓ माल आ गया है - सबमिट करें \(Confirm Arrival\)', r'✓ Goods Arrived - Submit (Confirm Arrival)'),
        (r'User requested: जब माल आ जाए तो सबमिट कर देगा तो सबको अपडेट मिल जाए', r'User requested: When material arrives, submitting it will notify everyone'),

        # MaintenanceAuditView.tsx
        (r'रॉ मटेरियल से लेकर ग्राहक के बॉक्स तक 360° ट्रेसेबिलिटी, कंप्लेंट व रिपोर्ट', r'360° Traceability from raw material to customer box, complaints & reports'),
        (r'360° Root-to-Box Traceability \(ट्रेसेबिलिटी जांच\)', r'360° Root-to-Box Traceability'),
        (r'Single Batch Report & Certificate \(बैच रिपोर्ट\)', r'Single Batch Report & Certificate'),
        (r'Search Delivered Box / Customer / Invoice / Job / Lot \(रॉ मटेरियल से बॉक्स तक सर्च करें\):', r'Search Delivered Box / Customer / Invoice / Job / Lot:'),
        (r'Log Customer Complaint \(कंप्लेंट दर्ज करें\)', r'Log Customer Complaint'),
        (r'Complete Backward & Forward Traceability Chain \(कस्टमर डिलीवरी से मूल रॉ मटेरियल तक\)', r'Complete Backward & Forward Traceability Chain'),
        (r'Step 7: Customer Delivery & Gatepass \(ग्राहक तक डिलीवरी\)', r'Step 7: Customer Delivery & Gatepass'),
        (r'Step 6: Box Packing & Assembly \(पैकिंग व सीलिंग\)', r'Step 6: Box Packing & Assembly'),
        (r'Step 5: QC Inspection & Defect Screening \(क्वालिटी इंस्पेक्शन\)', r'Step 5: QC Inspection & Defect Screening'),

        # CuttingView.tsx
        (r'मशीन \[\$\{selectedMachine\}\] का चालू कार्यभार ऑपरेटर \$\{handoverData\.relievedByOperator\} \(\$\{handoverData\.nextShift\} Shift\)\$\{nextHelpers\.length > 0 \? ` \+ \$\{nextHelpers\.length\} Helpers \(\$\{nextHelpers\.join\(\', \'\}\)\)` : \'\'\} को बिना काम रोके सौंप दिया गया है।', r'Ongoing charge of machine [${selectedMachine}] has been handed over to Operator ${handoverData.relievedByOperator} (${handoverData.nextShift} Shift)${nextHelpers.length > 0 ? ` + ${nextHelpers.length} Helpers (${nextHelpers.join(\', \')})` : \'\'} without stopping work.'),

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
    'src/components/views/PurchaseView.tsx',
    'src/components/views/MaintenanceAuditView.tsx',
    'src/components/views/CuttingView.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

