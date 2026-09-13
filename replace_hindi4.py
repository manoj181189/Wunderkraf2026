import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # HoldModal.tsx
        (r'Hydraulic / Pneumatic Pressure Loss \(हाइड्रोलिक/एयर प्रेशर कमी\)', r'Hydraulic / Pneumatic Pressure Loss'),
        (r'Speed Mismatch / Cycle Timing Error \(स्पीड बेमेल\)', r'Speed Mismatch / Cycle Timing Error'),
        (r'Mould Tooling & Teflon Strip Damage \(मोल्ड टूलिंग / टेफ्लॉन क्षति\)', r'Mould Tooling & Teflon Strip Damage'),
        (r'Paper Forming Wrinkle / Tear \(कप/चम्मच रिम व क्रैक फॉल्ट\)', r'Paper Forming Wrinkle / Tear'),
        (r'Leak Test Fail \(Water Penetration\) \(लीक टेस्ट फेल\)', r'Leak Test Fail (Water Penetration)'),
        (r'Burst / Compression Test Fail \(बर्स्ट स्ट्रेंथ फेल\)', r'Burst / Compression Test Fail'),
        (r'Dimension Out-of-Tolerance \(Angle/Depth\) \(साइज/डायमेंशन विचलन\)', r'Dimension Out-of-Tolerance (Angle/Depth)'),
        (r'Visual Blemish / Print Ink Smudge / Spot \(सतह पर दाग/खराबी\)', r'Visual Blemish / Print Ink Smudge / Spot'),
        (r'Rim Curl / Edge Flange Defect \(रिम कर्ल खराबी\)', r'Rim Curl / Edge Flange Defect'),
        (r'Rewind Tension / Core Slippage \(कोर स्लिपेज / टेंशन फॉल्ट\)', r'Rewind Tension / Core Slippage'),
        (r'Slitting Circular Blade Dull / Burr \(कटर ब्लेड बर्र\)', r'Slitting Circular Blade Dull / Burr'),
        (r'Jumbo Reel Unwind Chuck Loose \(अनवाइंड चक ढीला\)', r'Jumbo Reel Unwind Chuck Loose'),
        (r'Web Alignment Guide Sensor Drift \(एलाइनमेंट ड्रिफ्ट\)', r'Web Alignment Guide Sensor Drift'),
        (r'"👨‍🔧 मैं अटेंड कर रहा हूँ"', r'"👨‍🔧 I am Attending"'),
        (r'"रिपेयर पूरा हुआ"', r'"Repair Completed"'),
        (r'Machine Stop & Maintenance Alert \(मशीन स्टॉप व मेंटेनेंस अलर्ट\)', r'Machine Stop & Maintenance Alert'),
        (r'मशीन बंद करने पर मेंटेनेंस टीम को तत्काल अलर्ट चला जाएगा और मेंटेनेंस डेस्क पर टिकट दर्ज होगा।', r'Stopping the machine will send an immediate alert to the maintenance team and create a ticket on the maintenance desk.'),
        (r'Priority Level \(प्राथमिकता\):', r'Priority Level:'),
        (r'🟢 Normal \(साधारण\)', r'🟢 Normal'),
        (r'🟠 Urgent \(जरूरी\)', r'🟠 Urgent'),
        (r'🔴 Critical \(अति आवश्यक / लाइन जाम\)', r'🔴 Critical (Line Jam)'),
        (r'Reason for Hold / Breakdown \(स्टॉप का कारण\):', r'Reason for Hold / Breakdown:'),
        (r'Operator Lunch / Tea Break \(चाय/लंच ब्रेक\)', r'Operator Lunch / Tea Break'),
        (r'Raw Material Supply Shortage \(मटेरियल कमी\)', r'Raw Material Supply Shortage'),
        (r'Other Emergency Technical Fault \(अन्य आपातकालीन खराबी\)', r'Other Emergency Technical Fault'),
        (r'Custom Description / Technical Details \(विस्तृत जानकारी\):', r'Custom Description / Technical Details:'),
        (r'Reporting Operator Name \(ऑपरेटर का नाम\):', r'Reporting Operator Name:'),
        (r'\(User requirement: "नंबर एक डालने की सुविधा चाहिए"\)', r''),
        (r'Maintenance Phone Number \(मेंटेनेंस नंबर\):', r'Maintenance Phone Number:'),
        (r'\* आप ऊपर से संपर्क चुन सकते हैं या नया फोन नंबर सीधे टाइप कर सकते हैं।', r'* You can select a contact from above or type a new phone number directly.'),
        (r'Stop Silently \(केवल स्टॉप\)', r'Stop Silently'),

        # StockDetailModal.tsx
        (r'Slit Rolls Stock \(स्लिटिंग रोल्स\)', r'Slit Rolls Stock'),
        (r'unitHindi: \'रोल्स\',', r"unitHindi: 'Rolls',"),
        (r'Cut Crates Stock \(कटिंग क्रेट्स\)', r'Cut Crates Stock'),
        (r'unitHindi: \'क्रेट्स\',', r"unitHindi: 'Crates',"),
        (r'Formed Crates Stock \(फॉर्मिंग क्रेट्स\)', r'Formed Crates Stock'),
        (r'QC Approved Stock \(क्यू\.सी\. पास क्रेट्स\)', r'QC Approved Stock'),
        (r'Ready Packed Goods \(डिस्पैच रेडी बॉक्सेस\)', r'Ready Packed Goods'),
        (r'unitHindi: \'बॉक्स\',', r"unitHindi: 'Boxes',"),
        (r'title="Close Modal \(बंद करें\)"', r'title="Close Modal"'),
        (r'प्रत्येक जॉब नंबर \(Job ID\), मदर रील \(Reel No\.\), GSM और पेपर मिल के अनुसार सटीक स्टॉक', r'Accurate stock by each Job ID, Mother Reel No, GSM and Paper Mill'),
        (r'विवरण', r'Details'),
        (r'Total In-Stock \(कुल स्टॉक\)', r'Total In-Stock'),
        (r'(.*?) अलग-अलग जॉब लॉट्स में', r'in \1 different job lots'),
        (r'Active Job Lots \(जॉब लॉट संख्या\)', r'Active Job Lots'),
        (r'Estimated Pieces \(अनुमानित नग\)', r'Estimated Pieces'),
        (r'Paper Mills in Stock \(कागज़ ब्रांड\)', r'Paper Mills in Stock'),
        (r'Search by Job ID, Reel No, Brand, GSM\.\.\. \(खोजें\)', r'Search by Job ID, Reel No, Brand, GSM...'),
        (r'Order ID \(ऑर्डर नं\.\)', r'Order ID'),
        (r'Customer \(ग्राहक\)', r'Customer'),
        (r'Job ID \(जॉब नंबर\)', r'Job ID'),
        (r'Mother Reel No\. \(मदर रील नं\.\)', r'Mother Reel No.'),
        (r'Paper Mill \(कागज़ ब्रांड\)', r'Paper Mill'),
        (r'>Close \(बंद करें\)<', r'>Close<'),

        # MachineReadyNotificationModal.tsx
        (r'मेंटेनेंस साइड से ओके है — मशीन रेडी!', r'OK from Maintenance side — Machine Ready!'),
        (r'Total Downtime \(बंद रहा\):', r'Total Downtime:'),
        (r'🛠️ Action Taken / Work Done \(क्या काम किया\):', r'🛠️ Action Taken / Work Done:'),
        (r'Spare Parts Replaced \(स्पेयर पार्ट्स\):', r'Spare Parts Replaced:'),
        (r'"मेरी साइड से मशीन ओके है। ऑपरेटर रन बटन दबाकर प्रोडक्शन चालू कर सकता है।"', r'"Machine is OK from my side. Operator can press the Run button to start production."')
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
    'src/components/MachineReadyNotificationModal.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

