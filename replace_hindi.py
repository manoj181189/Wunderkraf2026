import os
import re
from typing import List

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # MachineBreakdownBanner.tsx
        (r'👨‍🔧 मैं अटेंड कर रहा हूँ \(Technician Reply\)', r'👨‍🔧 I am Attending (Technician Reply)'),
        (r'📢 जो मेंटेनेंस टेक्नीशियन इस मशीन पर काम करने आया है, वह <b>"मैं अटेंड कर रहा हूँ"</b> बटन दबाकर तुरंत काम शुरू दर्ज करे।', r'📢 The Maintenance Technician who came to work on this machine should press the <b>"I am Attending"</b> button to log the start of work immediately.'),
        (r'ब्रेकडाउन विवरण बदलें', r'Change Breakdown Details'),
        
        # StationCrewModal.tsx
        (r'मशीन क्रू व हेल्पर आवंटन', r'Machine Crew & Helper Allocation'),
        (r'मशीन ऑपरेटर \(Main Machine Operator\) \*', r'Main Machine Operator *'),
        (r'आवंटित हेल्पर \(Assigned Helpers on this Machine\)', r'Assigned Helpers on this Machine'),
        (r'कटिंग/मशीन चालू होते ही यह हेल्पर सीधे नीचे दिए गए मैनपावर ट्रैकर में ऑपरेटर के साथ लाइव दिखेंगे।', r'As soon as the cutting/machine starts, these helpers will be visible live with the operator in the Manpower Tracker below.'),
        (r'नया हेल्पर नाम दर्ज करें \(e.g. BABLU_HELPER\)', r'Enter new helper name (e.g. BABLU_HELPER)'),
        (r'>जोड़ें<', r'>Add<'),
        (r'लाइव स्टेशन मैनपावर प्रीव्यू \(Floor Tracker Preview\)', r'Floor Tracker Preview (Live Station Manpower)'),
        (r'मशीन <strong>(.*?)</strong> पर ऑपरेटर <strong>(.*?)</strong> काम करेंगे तथा उनके साथ', r'Operator <strong>\2</strong> will work on machine <strong>\1</strong> and with them'),
        (r'<strong>(.*?) हेल्पर</strong> \((.*?)\) तैनात रहेंगे।', r'<strong>\1 Helpers</strong> (\2) will be deployed.'),
        (r'कोई नहीं', r'None'),
        (r'रद्द करें \(Cancel\)', r'Cancel'),
        (r'क्रू व हेल्पर कन्फर्म करें \(Save & Deploy\)', r'Confirm Crew & Helpers (Save & Deploy)'),

        # OpeningStockModal.tsx
        (r'Rolls \(रोल्स\)', r'Rolls'),
        (r'Crates \(क्रेट्स\)', r'Crates'),
        (r'Boxes \(डिब्बे\)', r'Boxes'),
        (r'⚠️ संख्या 0 या उससे अधिक होनी चाहिए।', r'⚠️ Quantity must be 0 or more.'),
        (r'किसी भी आइटम या स्टेज के लिए प्रारंभिक स्टॉक सीधे दर्ज या अपडेट करें', r'Directly enter or update the initial stock for any item or stage'),
        (r'1. उत्पाद चुनें \(Select Product\): \*', r'1. Select Product: *'),
        (r'पेपर मिल / ब्रांड \(Mill\):', r'Paper Mill / Brand:'),
        (r'2. स्टॉक स्टेज चुनें \(Select Production Stage\): \*', r'2. Select Production Stage: *'),
        (r'वर्तमान चयन: (.*?)<', r'Current Selection: \1<'),
        (r'>स्लिट रोल्स<', r'>Slit Rolls<'),
        (r'>कटिंग क्रेट्स<', r'>Cutting Crates<'),
        (r'>फॉर्मिंग क्रेट्स<', r'>Forming Crates<'),
        (r'>पास क्रेट्स<', r'>Pass Crates<'),
        (r'>तैयार डिब्बे<', r'>Ready Boxes<'),
        (r'ओपनिंग स्टॉक संख्या \((.*?)\): \*', r'Opening Stock Quantity (\1): *'),
        (r'अनुमानित पीस प्रति (.*?) \(Pcs/Unit\):', r'Estimated Pieces per \1 (Pcs/Unit):'),
        (r'रोल', r'Roll'),
        (r'बॉक्स', r'Box'),
        (r'क्रेट', r'Crate'),
        (r'कुल अनुमानित पीस \(Total Equivalent Pieces\):', r'Total Equivalent Pieces:'),
        (r'लॉट / रील संदर्भ \(Lot Reference\):', r'Lot / Reel Reference:'),
        (r'अपडेट का प्रकार \(Action Mode\):', r'Update Type (Action Mode):'),
        (r'\+ Add to Existing \(जोड़ें\)', r'+ Add to Existing'),
        (r'Set Exact Balance \(नया कुल\)', r'Set Exact Balance'),
        (r'रद्द करें \(Cancel\)', r'Cancel'),
        (r'💾 Save Opening Stock \(ओपनिंग स्टॉक सेव करें\)', r'💾 Save Opening Stock'),

        # ShiftHandoverHistoryModal.tsx
        (r'ऑपरेटर शिफ्ट हैंडओवर रिकॉर्ड्स, उत्पादन संख्या एवं डिजिटल हस्ताक्षर सत्यापन', r'Operator Shift Handover Records, Production Quantities & Digital Signature Verification'),
        (r'All Departments \(सभी विभाग\)', r'All Departments'),
        (r'Slitting \(स्लिटिंग\)', r'Slitting'),
        (r'Cutting \(कटिंग\)', r'Cutting'),
        (r'Forming \(फॉर्मिंग\)', r'Forming'),
        (r'QC Inspection \(क्यूसी\)', r'QC Inspection'),
        (r'Packing \(पैकिंग\)', r'Packing'),
        (r'Relieved Operator \(निवर्तमान\)', r'Relieved Operator'),
        (r'Relieving Operator \(आगामी\)', r'Relieving Operator'),

        # Header.tsx
        (r'Machine & Operator Performance Audit \(मशीन व ऑपरेटर परफ़ॉर्मेंस ऑडिट\)', r'Machine & Operator Performance Audit'),
        (r'Live Plant Floor Workforce & Helpers Audit \(लाईव मैनपावर व हेल्पर ट्रैकर\)', r'Live Plant Floor Workforce & Helpers Audit'),
        (r'मैनपावर', r'Manpower'),
        (r'Material Requisition & Purchase Tracking \(मटेरियल इंडेन्ट\)', r'Material Requisition & Purchase Tracking'),
        (r'>इंडेन्ट \(Requisition\)<', r'>Requisition<'),
        (r'Shift Handover History & Operator Signatures Dossier \(शिफ्ट हैंडओवर ऑडिट\)', r'Shift Handover History & Operator Signatures Dossier'),
        (r'>हैंडओवर<', r'>Handover<'),
        (r'Re-hydrate & Synchronize State from IndexedDB \(डेटा रिफ्रेश\)', r'Re-hydrate & Synchronize State from IndexedDB'),
        (r'Switch Active Operator Desk \(यूज़र बदलें\)', r'Switch Active Operator Desk'),

        # App.tsx
        (r'मेंटेनेंस साइड से ओके होने पर पॉपअप', r'Popup when marked OK from Maintenance side'),

        # types.ts
        (r'जब माल आ जाए', r'When goods are received'),

        # AdminSettingsView.tsx
        (r'नया उत्पाद क्रेट मानक जोड़ें', r'Add New Product Crate Standard'),
        (r'यूज़र आईडी एवं अधिकार प्रबंधन', r'User ID & Access Management'),
        (r'यूज़र प्रबंधन व अधिकार', r'User Management & Access Rights'),
        (r'अधिकार चेकबॉक्स', r'Rights Checkboxes'),
        (r'मशीन ऑपरेटर सूची', r'Machine Operators List'),
        (r'मास्टर डाटा सुधार', r'Master Data Correction'),
        (r'जॉब नंबर', r'Job Number'),
        (r'आइटम प्रकार', r'Item Type'),
        (r'रील नंबर व वजन सुधारें', r'Correct Reel Number & Weight'),
        (r'रील नंबर', r'Reel Number'),
        (r'स्टॉक बैलेंस सीधा सुधारें', r'Correct Stock Balances Directly'),
        (r'नंग', r'Pieces'),
        (r'व्हाट्सएप बैकअप', r'WhatsApp Backup'),
        (r'व्हाट्सएप शिफ्ट चेंजओवर रिपोर्ट', r'WhatsApp Shift Changeover Reports'),
        (r'समय कस्टमाइज़', r'Customize Timing'),
        (r'मेंटेनेंस डेस्क मास्टर व राइट्स', r'Maintenance Desk Master & Rights'),
        (r'मेंटेनेंस डेस्क मास्टर एवं राइट्स', r'Maintenance Desk Master & Rights Suite'),
        (r'रील से पीस लिमिट', r'Roll to Pcs Limit'),

        # PackingView.tsx
        (r'उसी ऑर्डर में और क्रेट्स देना', r'Add more crates to the same order'),
        (r'`मशीन चालू है और नए क्रेट्स उसी ऑर्डर में जुड़ गए हैं।`', r'`Machine is running and new crates have been added to the same order.`'),
        (r'मशीन फ्लोर डैशबोर्ड कार्ड्स', r'Machine Floor Dashboard Cards'),
        (r'मशीन चुनें', r'Select Machine'),
        (r'और क्रेट्स जोड़ें', r'Add More Crates'),
        (r'बॉक्स तैयार', r'Boxes Ready'),
        (r'💡 <b>Note:</b> Forward Partial करने पर जितने बॉक्स आपने दर्ज किए हैं, वे तुरंत <b>Dispatch</b> में उपलब्ध हो जाएंगे और मशीन <b>चालू \(RUNNING\)</b> रहेगी। जब तक आप <b>"Complete Job"</b> नहीं दबाएंगे, मशीन नहीं रुकेगी।', r'💡 <b>Note:</b> When you do Forward Partial, the boxes you entered will immediately be available in <b>Dispatch</b> and the machine will remain <b>RUNNING</b>. The machine will not stop until you press <b>"Complete Job"</b>.'),
        (r'अगर आपने ज्यादा क्रेट इशू कर दिए थे और काम पूरा होने के बाद क्रेट बच गए हैं, तो यहाँ से सीधे QC स्टॉक में वापस जमा करें:', r'If you had issued excess crates and crates are left over after the work is complete, return them directly to QC stock from here:'),
        (r'क्या आप <b>\[(.*?)\]</b> पर चल रहे आर्डर <b>\[(.*?) — (.*?)\]</b> के रन को रद्द और डिलीट करना चाहते हैं\?', r'Do you want to cancel and delete the run of order <b>[\2 — \3]</b> currently running on <b>[\1]</b>?'),
        (r'⚡ पुष्टि करने पर यह रनिंग एंट्री हट जाएगी, मशीन <b>IDLE</b> हो जाएगी और सारा मटेरियल सुरक्षित वापस QC स्टॉक में चला जाएगा।', r'⚡ Upon confirmation, this running entry will be removed, the machine will become <b>IDLE</b>, and all material will be safely returned to QC stock.'),
        (r'मशीन में कोई तकनीकी या मटेरियल समस्या आने पर होल्ड कारण दर्ज करें ताकि मेंटेनेंस टीम को तुरंत अलर्ट मिल सके:', r'If there is any technical or material issue in the machine, enter the hold reason so the maintenance team gets alerted immediately:'),
        (r'उसी रनिंग आर्डर में अतिरिक्त QC क्रेट्स इशू करें', r'Issue additional QC crates to the same running order'),

        # FormingView.tsx
        (r'ऑपरेटर के साथ नियुक्त हेल्पर \(Assigned Helpers\):', r'Assigned Helpers with Operator:'),
        (r'क्रू व हेल्पर पॉप-अप \(Modal\)', r'Crew & Helper Modal'),
        (r'Date \(तारीख\)', r'Date'),

        # MarketingView.tsx
        (r'ऑर्डर सफलतापूर्वक सबमिट हो गया है!', r'Order submitted successfully!'),
        (r'\+ नया ऑर्डर दर्ज करें \(Enter Next Order\)', r'+ Enter Next Order'),
        (r'मुख्य मेनू पर जाएं \(Back to Main Hub\)', r'Back to Main Hub'),

        # MasterExecutiveDashboard.tsx
        (r'Machine & Operator Audit \(8-दिन/5-दिन रिपोर्ट\) ➔', r'Machine & Operator Audit (8-day/5-day report) ➔'),
        (r'Real-Time QC Dispatch & Inspector Pipeline \(रियल-टाइम क्यूसी डिस्पैच व इंस्पेक्टर स्थिति\)', r'Real-Time QC Dispatch & Inspector Pipeline'),
        (r'फॉर्मिंग से डिस्पैच किए गए क्रेट्स, नियुक्त इंस्पेक्टर \(Assigned Inspector\) व स्टेज स्थिति', r'Crates dispatched from Forming, Assigned Inspector & Stage Status'),
        (r'कार्यरत टेक्नीशियन:', r'Working Technician:'),
        (r'✅ रिपेयर पूरा करें \(Mark Ready\)', r'✅ Mark Ready'),
        (r'ब्रेकडाउन \(इंतज़ार जारी\):', r'Breakdown (Waiting):'),
        (r'👨‍🔧 मैं अटेंड कर रहा हूँ \(Start Repair\)', r'👨‍🔧 I am Attending (Start Repair)'),
        (r'रियल-टाइम क्यूसी डिस्पैच व इंस्पेक्टर स्थिति', r'Real-Time QC Dispatch & Inspector Pipeline'),

        # MaintenanceView.tsx
        (r'⚠️ कृपया स्पेयर पार्ट का नाम दर्ज करें!', r'⚠️ Please enter the spare part name!'),
        (r'✅ (.*?) ने (.*?) पर काम शुरू कर दिया है।\\nस्थिति: "यह आदमी यहां पर काम कर रहा है" सक्रिय हो गई है।', r'✅ \1 has started working on \2.\nStatus: "This person is working here" has been activated.'),
        (r'Attend / Start Repair \(अटेंड करें\)', r'Attend / Start Repair'),
        (r'यह आदमी यहां पर काम कर रहा है', r'This person is working here'),
        (r'👨‍🔧 यह आदमी यहां पर काम कर रहा है \(Active Attending\):', r'👨‍🔧 This person is working here (Active Attending):'),
        (r'काम शुरू:', r'Work Started:'),
        (r'• (.*?) मिनट से कार्य चालू', r'• Working for \1 minutes'),
        (r'बदलें \(Change Person\)', r'Change Person'),
        (r'Spare Parts Replaced \(स्पेयर पार्ट रिप्लेसमेंट\):', r'Spare Parts Replaced:'),
        (r'\+ नया कस्टम पार्ट लिखें', r'+ Enter New Custom Part'),
        (r'नया स्पेयर जोड़ें:', r'Add New Spare:'),
        (r'नया स्पेयर पार्ट दर्ज करने के लिए पॉपअप खोलें', r'Open popup to enter new spare part'),
        (r'कस्टम पार्ट पॉप-अप', r'Custom Part Popup'),
        (r'📋 लिस्ट से चुनें', r'📋 Choose from List'),
        (r'✍️ सीधे नाम टाइप करें', r'✍️ Type Name Directly'),
        (r'पार्ट का नाम टाइप करें...', r'Type part name...'),
        (r'➕ नया कस्टम पार्ट लिखें \(Custom Part Popup\)\.\.\.', r'➕ Enter New Custom Part (Popup)...'),
        (r'Breakdown Timing & Duration Tracking \(स्टार्ट / स्टॉप समय\):', r'Breakdown Timing & Duration Tracking (Start / Stop Time):'),
        (r'Breakdown Start Time \(शुरुआत का समय\):', r'Breakdown Start Time:'),
        (r'Breakdown Stop Time \(समाप्ति का समय\):', r'Breakdown Stop Time:'),
        (r'Downtime Difference \(दोनों समय का अंतर\):', r'Downtime Difference:'),
        (r'Breakdown Start \(स्टार्ट समय\)', r'Breakdown Start'),
        (r'Breakdown Stop \(स्टॉप समय\)', r'Breakdown Stop'),
        (r'Difference / कुल अंतर', r'Difference / Total'),
        (r'Breakdown Start Date \(तारीख\):', r'Breakdown Start Date:'),
        (r'Breakdown Start Time \(समय\):', r'Breakdown Start Time:'),
        
        # New additions for MaintenanceView to ensure everything is matched
        (r'\(Technician Reply\)', r''),
        (r'मशीन और ऑपरेटर', r'Machine and Operator'),
        (r'\(स्टार्ट समय\)', r''),
        (r'\(स्टॉप समय\)', r''),
        (r'कुल अंतर', r'Total Diff'),
        (r'तारीख', r'Date'),
        (r'समय', r'Time'),
    ]

    for p, r in replacements:
        content = re.sub(p, r, content)

    # Some basic extra pass for leftover Hindi characters (optional, to just strip or replace with generic english)
    # We will try to map specific ones manually, but we can also do a broad check
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files_to_process = [
    'src/components/MachineBreakdownBanner.tsx',
    'src/components/StationCrewModal.tsx',
    'src/components/OpeningStockModal.tsx',
    'src/components/ShiftHandoverHistoryModal.tsx',
    'src/components/Header.tsx',
    'src/App.tsx',
    'src/types.ts',
    'src/components/views/AdminSettingsView.tsx',
    'src/components/views/PackingView.tsx',
    'src/components/views/FormingView.tsx',
    'src/components/views/MarketingView.tsx',
    'src/components/views/MasterExecutiveDashboard.tsx',
    'src/components/views/MaintenanceView.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

