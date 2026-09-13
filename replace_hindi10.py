import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # CuttingView.tsx
        (r'लूज़ पीस - मेन काउंटर में प्लस होगा\):', r'Loose Pieces - Will be added to main counter):'),
        (r'1\. रिजेक्टेड पीस \(Rejected Pieces\):', r'1. Rejected Pieces:'),
        (r'⚠️ <b>केवल यही रिजेक्टेड पीस तैयार पीस में से माइनस \(-\) होगा।</b> \(दोनों मिक्स नहीं होंगे\)', r'⚠️ <b>Only these rejected pieces will be minus (-) from prepared pieces.</b> (Both will not mix)'),
        (r'2\. कटिंग मटेरियल स्क्रैप \(Material Scrap KG\):', r'2. Cutting Material Scrap KG:'),
        (r'ℹ️ <b>कटिंग में से जो एक्स्ट्रा पेपर स्क्रैप निकलता है, वह सीधे स्क्रैप खाते में जुड़ेगा। यह पीसेस में से माइनस नहीं होगा।</b>', r'ℹ️ <b>Extra paper scrap from cutting will directly add to scrap account. It will not be minus from pieces.</b>'),
        (r'Row 2\.5: Adhesive/Glue Inline Consumption Input \(ग्लू खपत इनपुट\)', r'Row 2.5: Adhesive/Glue Inline Consumption Input'),
        (r'3\. एक्चुअल ग्लू यूसेज \(Actual Glue Consumed KG\) \*:', r'3. Actual Glue Consumed KG *:'),
        (r'Main Counter Live Calculation \(मेन काउंटर लाइव हिसाब\):', r'Main Counter Live Calculation:'),
        (r'Crates \+ Loose - केवल रिजेक्टेड पीस', r'Crates + Loose - Only rejected pieces'),
        (r'अलग से कटिंग स्क्रैप: <b>(.*?) KG</b> \(पीस में से माइनस नहीं\)', r'Separate Cutting Scrap: <b>\1 KG</b> (Not minus from pieces)'),
        (r'title="स्टेशन क्रू व हेल्पर बदलें"', r'title="Change Station Crew & Helper"'),
        (r'क्रू व हेल्पर', r'Crew & Helper'),
        (r'title="एडहेसिव ग्लू यूसेज दर्ज करें"', r'title="Enter Adhesive Glue Usage"'),
        (r'ग्लू यूज़', r'Glue Usage'),
        (r'🤝 ऑपरेटर के साथ नियुक्त हेल्पर \(Assigned Helpers\):', r'🤝 Assigned Helpers with Operator:'),
        (r'👥 क्रू व हेल्पर पॉप-अप \(Modal\)', r'👥 Crew & Helper Modal'),
        (r'\(उदा\. ऑपरेटर \+ 2 हेल्पर साइड में दिखाई देंगे\)', r'(e.g. Operator + 2 Helpers will appear on side)'),
        (r'\+ नया हेल्पर नाम\.\.\.', r'+ New helper name...'),
        (r'\+ जोड़ें', r'+ Add'),
        (r'Date \(तारीख\)', r'Date'),

        # AdminSettingsView.tsx
        (r'⚡ All Factory Data Reset to 0 for Clean Testing \(पूरा डेटा 0 किया गया\)', r'⚡ All Factory Data Reset to 0 for Clean Testing'),
        (r'⚡ Zero All Operational Data \(पूरा डेटा 0 करें\)', r'⚡ Zero All Operational Data'),
        (r'Yes, Reset All to 0 \(डेटा 0 करें\)', r'Yes, Reset All to 0'),
        (r'\(Rolls\|रील\)', r'(Rolls)'),
        (r'🛒 Purchase & Indent Desk\', desc: \'Material Indents, Vendor POs & Incoming Goods \(माल प्राप्ति\)', r"🛒 Purchase & Indent Desk', desc: 'Material Indents, Vendor POs & Incoming Goods"),
        (r'TAB 0: BRAND ITEMS & PAPER MILL MASTER \(ब्रांड आइटम एवं पेपर मिल मास्टर\)', r'TAB 0: BRAND ITEMS & PAPER MILL MASTER'),
        (r'Zero Data & Clean Setup \(डेटा 0 करें\)', r'Zero Data & Clean Setup'),
        (r'Reset All Data to 0 \(डेटा 0 करें\)', r'Reset All Data to 0'),
        (r'📜 Paper Mill / Supplier Brands \(पेपर मिल / ब्रांड लिस्ट\)', r'📜 Paper Mill / Supplier Brands'),
        (r'🍽️ Brand Cutlery Items & Products \(कटलरी उत्पाद प्रबंधन\)', r'🍽️ Brand Cutlery Items & Products'),
        (r'title="Edit Next Sequence Counter \(उदा\. 1, 2, 3\.\.\.\)"', r'title="Edit Next Sequence Counter (e.g. 1, 2, 3...)"'),
        (r'💧 Adhesive / Glue Brands \(ग्लू ब्रांड लिस्ट\)', r'💧 Adhesive / Glue Brands'),
        (r'📚 Target Layers Master \(टारगेट लेयर्स\)', r'📚 Target Layers Master'),
        (r'⚖️ Target GSM Master \(टारगेट GSM\)', r'⚖️ Target GSM Master'),
        (r'TAB 0\.5: CRATE CAPACITY MASTER \(Crate कैपेसिटी एवं वॉल्यूम फैलाव मास्टर\)', r'TAB 0.5: CRATE CAPACITY MASTER (Crate Capacity & Volume Expansion Master)'),
        (r'Crate Capacity Master & Volume Expansion \(Crate कैपेसिटी एवं 3D फैलाव मास्टर\)', r'Crate Capacity Master & Volume Expansion'),
        (r'🔐 <strong>Admin Exclusive Control:</strong> सेट करें कि प्रत्येक Crate में कटिंग \(Flat Blanks\) और फॉर्मिंग \(3D Molded\) के कितने Pieces आते हैं।', r'🔐 <strong>Admin Exclusive Control:</strong> Set how many pieces of Cutting (Flat Blanks) and Forming (3D Molded) come in each Crate.'),
        (r'Reset Defaults \(डिफ़ॉल्ट\)', r'Reset Defaults'),
        (r'Save Master Matrix \(मास्टर सेव\)', r'Save Master Matrix'),
        (r'Physical Manufacturing Law: Flat Blanks vs\. 3D Molded Volume Expansion \(वॉल्यूम विस्तार सिद्धांत\)', r'Physical Manufacturing Law: Flat Blanks vs. 3D Molded Volume Expansion'),
        (r'✂️ 1\. कटिंग \(Flat Blanks\)', r'✂️ 1. Cutting (Flat Blanks)'),
        (r'कागज पूरी तरह सपाट रहता है। स्टैकिंग घनी होती है, इसलिए Crate में अधिक Pieces आते हैं \(उदा\. Spoon: <strong>10,000 Pcs/Crate</strong>\)।', r'Paper remains completely flat. Stacking is dense, so more Pieces fit in a Crate (e.g. Spoon: <strong>10,000 Pcs/Crate</strong>).'),
        (r'⚙️ 2\. फॉर्मिंग \(3D Curved Shape\)', r'⚙️ 2. Forming (3D Curved Shape)'),
        (r'मोल्डिंग से गहराई \(Depth/Curve\) आ जाती है जिससे प्रत्येक पीस का आयतन बढ़ जाता है। Crate में कम Pieces आते हैं \(उदा\. Spoon: <strong>7,000 Pcs/Crate</strong>\)।', r'Molding adds depth (Depth/Curve) increasing the volume of each piece. Fewer Pieces fit in a Crate (e.g. Spoon: <strong>7,000 Pcs/Crate</strong>).'),
        (r'🔍 3\. QC लॉकिंग \(Strict 1:1\)', r'🔍 3. QC Locking (Strict 1:1)'),
        (r'फॉर्मिंग के बाद कोई आकार नहीं बदलता। इसलिए QC में 1:1 Crate लॉकिंग रहती है \(<strong>15 Formed Crates In = 15 QC Crates Max</strong>\)।', r'No shape changes after forming. So 1:1 Crate locking remains in QC (<strong>15 Formed Crates In = 15 QC Crates Max</strong>).'),
        (r'Standard Crate Capacity per Product \(उत्पादवार Crate मानक तालिका\)', r'Standard Crate Capacity per Product'),

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
    'src/components/views/CuttingView.tsx',
    'src/components/views/AdminSettingsView.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

