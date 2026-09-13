import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # StockMatrixView.tsx
        (r'लाइव फैक्ट्री स्टॉक मैट्रिक्स \(Live Factory Stock Matrix\)', r'Live Factory Stock Matrix'),
        (r'स्टेज-वाइज व जॉब-वाइज उपलब्ध माल की सटीक सूची', r'Exact list of available goods stage-wise and job-wise'),
        (r'⚡ Quick Opening Stock \(ओपनिंग स्टॉक दर्ज करें\)', r'⚡ Quick Opening Stock'),
        (r'स्लिटिंग रोल स्टॉक', r'Slitting Roll Stock'),
        (r'कटिंग ब्लैंक क्रेट्स', r'Cutting Blank Crates'),
        (r'फॉर्मिंग प्रेस क्रेट्स', r'Forming Press Crates'),
        (r'पैकिंग हेतु तैयार क्रेट्स', r'Crates Ready for Packing'),
        (r'डिस्पैच रेडी माल', r'Dispatch Ready Goods'),
        (r'<b>निर्देश:</b> किसी भी संख्या/बटन पर क्लिक करें — उस प्रोडक्ट के <b>जॉब नंबर \(Job ID\)</b>,', r'<b>Instructions:</b> Click on any number/button — based on that product\'s <b>Job ID</b>,'),
        (r'<b>मदर रील नंबर</b>, <b>GSM</b> और <b>पेपर मिल</b> के अनुसार कितनी-कितनी मात्रा स्टॉक में', r'<b>Mother Reel Number</b>, <b>GSM</b> and <b>Paper Mill</b>, how much quantity is in stock'),
        (r'है, पूरी हिस्ट्री व स्पेसिफिकेशन तालिका खुल जाएगी।', r'will open the full history and specification table.'),
        (r'Search Product \(उत्पाद खोजें\)\.\.\.', r'Search Product...'),
        (r'Total Factory Inventory \(कुल स्टॉक\):', r'Total Factory Inventory:'),
        (r'<b>Real-time Material Balance:</b> हर स्टेज पर क्रेट्स व रोल्स का हिसाब अलग-अलग जॉब लॉट्स', r'<b>Real-time Material Balance:</b> The account of crates and rolls at every stage in different job lots'),
        (r'में सुरक्षित और ट्रेस करने योग्य है।', r'is secure and traceable.'),

        # PlanningDeskView.tsx
        (r'Create Scheduled Plan \(नया प्लान\)', r'Create Scheduled Plan'),
        (r'Plan vs Actual Tracking Matrix \(योजना बनाम वास्तविक तुलना\)', r'Plan vs Actual Tracking Matrix'),
        (r'Warehouse Mother Reel Inventory \(कच्ची जंबो रील स्टॉक\)', r'Warehouse Mother Reel Inventory'),
        (r'Require Printed Roll \(प्रिंटेड रील की आवश्यकता है\)', r'Require Printed Roll'),

        # PurchaseView.tsx
        (r'कृपया वेंडर का नाम दर्ज करें \(Vendor name required\)', r'Please enter the vendor name (Vendor name required)'),
        (r'// Open Goods Received Modal \(जब माल आ गया है\)', r'// Open Goods Received Modal'),
        (r'// Submit Goods Received \(माल आ गया है\)', r'// Submit Goods Received'),
        (r'🎉 माल प्राप्ति दर्ज! \[(.*?)\] (.*?) का स्टेटस अब \'RECEIVED\' है और संबंधित डिपार्टमेंट को सूचना मिल गई है!', r'🎉 Goods receipt recorded! [\1] \2 status is now \'RECEIVED\' and the concerned department has been notified!'),
        (r'नमस्ते (.*?),\\n` \+', r'Hello \1,\n` +'),
        (r'`आपके डिपार्टमेंट \((.*?)\) द्वारा मांगा गया मटेरियल फैक्ट्री स्टोर में आ चुका है:\\n\\n` \+', r'`The material requested by your department (\1) has arrived at the factory store:\n\n` +'),
        (r'`📦 \*मटेरियल:\*', r'`📦 *Material:*'),
        (r'`🔢 \*मात्रा:\*', r'`🔢 *Quantity:*'),
        (r'`🔖 \*इंडेन्ट ID:\*', r'`🔖 *Indent ID:*'),
        (r'`📍 \*स्टोर लोकेशन:\*', r'`📍 *Store Location:*'),
        (r'`📄 \*GRN / बिल नं:\*', r'`📄 *GRN / Bill No:*'),
        (r'`📅 \*प्राप्ति तिथि:\*', r'`📅 *Receipt Date:*'),
        (r'`कृपया फैक्ट्री स्टोर से सामग्री प्राप्त कर अपने डेस्क पर \'Acknowledge Receipt\' मार्क करें।\\n` \+', r'`Please collect the material from the factory store and mark \'Acknowledge Receipt\' on your desk.\n` +'),
        (r'मटेरियल, इंडेन्ट ID, वेंडर, PO नंबर या डिपार्टमेंट से खोजें\.\.\.', r'Search by Material, Indent ID, Vendor, PO Number or Department...'),
        (r'सभी डिपार्टमेंट \(All Depts\)', r'All Depts'),
        (r'सभी स्टेटस \(All Status\)', r'All Status'),
        (r'⏳ Pending Review \(पेंडिंग\)', r'⏳ Pending Review'),
        (r'🚚 PO Issued / Ordered \(ऑर्डर किया\)', r'🚚 PO Issued / Ordered'),
        (r'✅ Arrived at Store \(माल आ गया\)', r'✅ Arrived at Store'),
        (r'सभी प्राथमिकताएं', r'All Priorities'),
        (r'कोई रिक्विजिशन नहीं मिला। आप "\+ नया इंडेन्ट भरें" से नई मांग दर्ज कर सकते हैं।', r'No requisition found. You can submit a new demand using "+ Raise Requisition".'),
        (r'दिनांक:', r'Date:'),
        (r'माल फैक्ट्री स्टोर में आ गया है \(Received\)', r'Goods have arrived at factory store (Received)'),
        (r'PO जारी / वेंडर को ऑर्डर भेजा', r'PO Issued / Order sent to vendor'),
        (r'जांच में लंबित \(Awaiting PO\)', r'Pending review (Awaiting PO)'),
        (r'मटेरियल / स्पेयर पार्ट', r'Material / Spare Part'),
        (r'कैटेगरी:', r'Category:'),
        (r'मकसद:', r'Purpose:'),
        (r'वेंडर को Issue PO / Order', r'Issue PO / Order to Vendor'),

        # CuttingView.tsx
        (r'`मशीन \[\$\{selectedMachine\}\] का चालू कार्यभार ऑपरेटर \$\{handoverData\.relievedByOperator\} \(\$\{handoverData\.nextShift\} Shift\)\$\{nextHelpers\.length > 0 \? ` \+ \$\{nextHelpers\.length\} Helpers \(\$\{nextHelpers\.join\(\', \'\}\)\)` : \'\'\} को बिना काम रोके सौंप दिया गया है।`', r'`Ongoing charge of machine [${selectedMachine}] has been handed over to Operator ${handoverData.relievedByOperator} (${handoverData.nextShift} Shift)${nextHelpers.length > 0 ? ` + ${nextHelpers.length} Helpers (${nextHelpers.join(\', \')})` : \'\'} without stopping work.`'),

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
    'src/components/views/StockMatrixView.tsx',
    'src/components/views/PlanningDeskView.tsx',
    'src/components/views/PurchaseView.tsx',
    'src/components/views/CuttingView.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

