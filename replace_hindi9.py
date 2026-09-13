import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # AdminSettingsView.tsx
        (r'Product Name \(उत्पाद\)', r'Product Name'),
        (r'📈 Crate Expansion Ratio \(वॉल्यूम फैलाव\)', r'📈 Crate Expansion Ratio'),
        (r'नया उत्पाद Crate मानक जोड़ें', r'Add New Product Crate Standard'),
        (r'अधिकार चेकBox', r'Rights Checkbox'),
        (r'जॉब, बैच, क्वालिटी, ऑर्डर व लॉग सुधार', r'Job, Batch, Quality, Order & Log Correction'),

        # PackingView.tsx
        (r'उसी ऑर्डर में और Crate्स देना', r'Add more crates to the same order'),
        (r'`मशीन चालू है और नए Crate्स उसी ऑर्डर में जुड़ गए हैं।`', r'`Machine is running and new crates have been added to the same order.`'),
        (r'और Crate्स जोड़ें', r'Add More Crates'),
        (r'Box तैयार', r'Boxes Ready'),
        (r'💡 <b>Note:</b> Forward Partial करने पर जितने Box आपने दर्ज किए हैं, वे तुरंत <b>Dispatch</b> में उपलब्ध हो जाएंगे और मशीन <b>चालू \(RUNNING\)</b> रहेगी। जब तक आप <b>"Complete Job"</b> नहीं दबाएंगे, मशीन नहीं रुकेगी।', r'💡 <b>Note:</b> When you do Forward Partial, the boxes you entered will immediately be available in <b>Dispatch</b> and the machine will remain <b>RUNNING</b>. The machine will not stop until you press <b>"Complete Job"</b>.'),
        (r'अगर आपने ज्यादा Crate इशू कर दिए थे और काम पूरा होने के बाद Crate बच गए हैं, तो यहाँ से सीधे QC स्टॉक में वापस जमा करें:', r'If you had issued excess crates and crates are left over after the work is complete, return them directly to QC stock from here:'),
        (r'उसी रनिंग आर्डर में अतिरिक्त QC Crate्स इशू करें', r'Issue additional QC crates to the same running order'),

        # MasterExecutiveDashboard.tsx
        (r'फॉर्मिंग से डिस्पैच किए गए Crate्स, नियुक्त इंस्पेक्टर \(Assigned Inspector\) व स्टेज स्थिति', r'Crates dispatched from Forming, Assigned Inspector & Stage Status'),

        # ShiftHandoverModal.tsx
        (r'कृपया आने वाले ऑपरेटर \(Relieving Operator\) का चयन करें या नाम लिखें।', r'Please select or enter the incoming relieving operator.'),
        (r'आने वाला ऑपरेटर \(Relieving Operator\) वर्तमान ऑपरेटर से भिन्न होना चाहिए।', r'Incoming relieving operator must be different from the current operator.'),
        (r'कृपया शिफ्ट हैंडओवर का सत्यापन चेकबॉक्स स्वीकार करें।', r'Please accept the shift handover verification checkbox.'),
        (r'कटिंग शिफ्ट हैंडओवर \(Cutting Desk Shift Handover\)', r'Cutting Desk Shift Handover'),
        (r'सतत शिफ्ट हैंडओवर', r'Continuous Shift Handover'),
        (r'मशीन को रोके बिना ऑपरेटर A का उत्पादन \(क्रेट्स, लूज पीस व स्क्रैप\) लॉक करें और ऑपरेटर B को बैच हैंडओवर करें।', r'Lock Operator A\'s production (crates, loose pieces & scrap) without stopping the machine and handover the batch to Operator B.'),
        (r'निवर्तमान ऑपरेटर \(Outgoing Operator A\) - उत्पादन व स्क्रैप लॉक', r'Outgoing Operator A - Production & Scrap Lock'),
        (r'इस ऑपरेटर के खाते में जमा होने वाला सटीक उत्पादन दर्ज करें', r'Enter accurate production to be credited to this operator\'s account'),
        (r'काटे गए क्रेट्स', r'Cut Crates'),
        (r'फुल तैयार क्रेट्स की संख्या', r'Number of fully prepared crates'),
        (r'खुले / लूज पीस \(Loose Pcs\):', r'Open / Loose Pieces (Loose Pcs):'),
        (r'अतिरिक्त खुले पीस \(जैसे 500 पीस\)', r'Extra open pieces (e.g. 500 pieces)'),
        (r'रिजेक्शन स्क्रैप \(Scrap in KG\):', r'Rejection Scrap (Scrap in KG):'),
        (r'डिफेक्ट पीस \(Defect Pieces\):', r'Defect Pieces:'),
        (r'कटिंग स्क्रैप वजन \(KG में\)', r'Cutting Scrap Weight (in KG)'),
        (r'खराब / रिजेक्टेड पीस', r'Defective / Rejected Pieces'),
        (r'कुल उत्पादित फ्लैट ब्लैंक्स:', r'Total Produced Flat Blanks:'),
        (r'मशीन स्ट्रोक / मीटर काउंटर \(Stroke Count\):', r'Machine Stroke / Meter Counter (Stroke Count):'),
        (r'हैंडओवर के समय मशीन का स्ट्रोक काउंटर', r'Machine stroke counter at handover time'),
        (r'हैंडओवर रिमार्क्स \(Handover Remarks / Notes\):', r'Handover Remarks / Notes:'),
        (r'उदा\. 5 क्रेट्स \+ 500 लूज पीस तैयार, 1 kg स्क्रैप, ब्लेड धार सही है।', r'e.g. 5 Crates + 500 loose pieces ready, 1 kg scrap, blade edge is fine.'),
        (r'ब्लेड की स्थिति, कच्चा माल या विशेष सूचना', r'Blade condition, raw material or special note'),
        (r'<b>रिकॉर्ड लॉक नोटिस:</b> सबमिट करने पर ऑपरेटर <b>(.*?)</b> के नाम', r'<b>Record Lock Notice:</b> Upon submission, against operator <b>\1</b>\'s name'),
        (r'क्रेट्स \+ (.*?) लूज पीस', r'Crates + \1 loose pieces'),
        (r'पीस\)', r'pieces)'),
        (r'और <span className="font-bold underline">(.*?) kg स्क्रैप</span> स्थायी रूप से दर्ज हो जाएंगे।', r'and <span className="font-bold underline">\1 kg scrap</span> will be permanently recorded.'),
        (r'आने वाला ऑपरेटर \(Incoming Relieving Operator B\)', r'Incoming Relieving Operator B'),
        (r'कार्यभार संभालने वाले ऑपरेटर एवं उनके साथ नियुक्त हेल्पर', r'Operator taking charge and helpers assigned with them'),
        (r'हैंडओवर समय:', r'Handover Time:'),
        (r'ऑपरेटर चुनें \(Select Relieving Operator\):', r'Select Relieving Operator:'),
        (r'-- ऑपरेटर का चयन करें --', r'-- Select Operator --'),
        (r'या नीचे नया नाम टाइप करें', r'Or type new name below'),

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
    'src/components/views/AdminSettingsView.tsx',
    'src/components/views/PackingView.tsx',
    'src/components/views/MasterExecutiveDashboard.tsx',
    'src/components/ShiftHandoverModal.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

