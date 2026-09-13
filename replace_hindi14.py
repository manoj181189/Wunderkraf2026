import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # QCView.tsx
        (r'✅ क्रेट्स टॉप-अप सफल \(Crate Top-up Successful\)!\n\n', r'✅ Crate Top-up Successful!\n\n'),
        (r'• इंस्पेक्टर:', r'• Inspector:'),
        (r'• जॉब:', r'• Job:'),
        (r'• पहले थे: (.*?) क्रेट्स\n', r'• Previous: \1 Crates\n'),
        (r'• नए दिए: \+(.*?) क्रेट्स\n', r'• Newly Added: +\1 Crates\n'),
        (r'• कुल हाथ में क्रेट्स \(Total in Hand\): (.*?) क्रेट्स\n\n', r'• Total in Hand: \1 Crates\n\n'),
        (r'सेम प्रोडक्ट होने के कारण अलग से डुप्लीकेट एंट्री नहीं बनी है, उसी रिकॉर्ड में संख्या अपडेट हो गई है।', r'Due to being the same product, a duplicate entry was not created; the quantity has been updated in the existing record.'),
        (r'✅ क्रेट्स टॉप-अप सफल \(Crate Top-up Successful\)!', r'✅ Crate Top-up Successful!'),
        (r'• जोड़े गए: \+(.*?) क्रेट्स\n', r'• Added: +\1 Crates\n'),
        (r'• अब कुल हाथ में क्रेट्स \(Total in Hand\): (.*?) क्रेट्स\n\n', r'• Total in Hand Now: \1 Crates\n\n'),
        (r'अलग से नई एंट्री नहीं बनी है, रिकॉर्ड में कुल क्रेट्स (.*?) अपडेट हो गए हैं।', r'No separate new entry created, total crates \1 updated in the record.'),
        (r'Active QC Inspection Lots \(निरीक्षण लॉट्स\):', r'Active QC Inspection Lots:'),
        (r'INSPECTOR / WORKER CRATE BALANCE TRACKING \(रमेश भाई व इंस्पेक्टर्स के पास क्रेट्स का हिसाब\)', r'INSPECTOR / WORKER CRATE BALANCE TRACKING (Crates Account for Inspectors)'),
        (r'Inspector Crates Live Balance \(इंस्पेक्टर के पास कितने क्रेट्स हैं\):', r'Inspector Crates Live Balance:'),
        (r'Same Job = Merged Balance \(अलग एंट्री नहीं बढ़ती\)', r'Same Job = Merged Balance (No separate entry)'),
        (r'Inspector \(आदमी का नाम\)', r'Inspector Name'),
        (r'Date & Shift \(तारीख व शिफ्ट\)', r'Date & Shift'),
        (r'Current in Hand \(हाथ में क्रेट्स\)', r'Current in Hand'),
        (r'Quick Top-up \(\+ और क्रेट्स दें\)', r'Quick Top-up (+ Add Crates)'),
        (r'Pieces / Crate \(नंग प्रति क्रेट\)', r'Pieces / Crate'),
        (r'Finished Pieces \(कुल पास नंग\)', r'Finished Pieces (Total Passed)'),
        (r'Passed / Approved QC Crates Output \(पास क्रेट्स\):', r'Passed / Approved QC Crates Output:'),
        (r'Loose Passed Pcs \(अतिरिक्त खुले पास नंग\):', r'Loose Passed Pcs:'),
        (r'Rejected Scrap \(KG\) \(रिजेक्ट स्क्रैप वजन\):', r'Rejected Scrap (KG):'),
        (r'Enter Formed Crates to Inspect \(इश्यू क्रेट्स\) \*:', r'Enter Formed Crates to Inspect (Issue Crates) *:'),
        (r'QC Reels & Traceability Register \(क्यूसी रील व जॉब आईडी रजिस्टर\)', r'QC Reels & Traceability Register'),
        (r'हर जॉब आईडी में प्रयुक्त रील नंबर, जीएसएम व आगे की स्टेज की ट्रेसेबिलिटी स्थिति', r'Reel number, GSM used in each Job ID and onward traceability status'),
        (r'Date \(तारीख\)', r'Date'),
        (r'Reel No\. \(रील नंबर\)', r'Reel No.'),
        (r'GSM \(जीएसएम\)', r'GSM'),
        (r'Traceability \(ट्रेसेबिलिटी\)', r'Traceability'),
        (r'title="ट्रेसेबिलिटी में देखें कि यह रील/लॉट कहाँ-कहाँ पहुँची"', r'title="See where this reel/lot reached in Traceability"'),
        (r'Top-up Crates to Inspector \(और क्रेट्स दें\)', r'Top-up Crates to Inspector'),
        (r'Enter Additional Crates to Give \(अतिरिक्त क्रेट्स संख्या\):', r'Enter Additional Crates to Give:'),

        # AnalyticsView.tsx
        (r'मशीन व ऑपरेटर उत्पादन रिपोर्ट \(8-दिन मशीन ऑडिट, 5-दिन/1-माह/6-माह ऑपरेटर परफ़ॉर्मेंस\)', r'Machine & Operator Production Report (8-day Machine Audit, 5-day/1-month/6-month Operator Performance)'),
        (r'🏭 Machine Performance \(मशीन 8-दिन ऑडिट\)', r'🏭 Machine Performance (8-Day Audit)'),
        (r'👷 Operator Productivity \(ऑपरेटर 5-दिन / 1-माह / 6-माह\)', r'👷 Operator Productivity (5-day / 1-month / 6-month)'),
        (r'🏆 Operator Leaderboard \(रैंकिंग तालिका\)', r'🏆 Operator Leaderboard (Ranking Table)'),
        (r'♻️ Scrap Recycling Desk \(स्क्रैप रीसाइक्लिंग\)', r'♻️ Scrap Recycling Desk'),
        (r'Select Machine \(मशीन चुनें\):', r'Select Machine:'),
        (r'All Machines \(संपूर्ण फैक्ट्री मशीनें\)', r'All Machines'),
        (r'⚡ 8 Days Output \(8 दिन का प्रोडक्शन\)', r'⚡ 8 Days Output (8 Day Production)'),
        (r'Total Pieces Produced \(कुल नंग\)', r'Total Pieces Produced'),
        (r'Total Crates / Units \(कुल कैरेट\)', r'Total Crates / Units'),
        (r'Machine Scrap & Defects \(स्क्रैप\)', r'Machine Scrap & Defects'),
        (r'Select Operator \(ऑपरेटर चुनें\):', r'Select Operator:'),
        (r'All Operators \(सभी ऑपरेटर\)', r'All Operators'),
        (r'⚡ 5 Days \(5 दिन का उत्पादन\)', r'⚡ 5 Days Output'),
        (r'📅 1 Month \(महीने दिन\)', r'📅 1 Month'),
        (r'📅 6 Months \(छह महीने\)', r'📅 6 Months'),
        (r'Total Operator Output \(कुल उत्पादन\)', r'Total Operator Output'),
        (r'Operator Productivity & Yield Leaderboard \(ऑपरेटर रैंकिंग व उत्पादकता स्कोर\)', r'Operator Productivity & Yield Leaderboard'),
        (r'Paper Scrap Management & Recycling Sales \(स्क्रैप रीसाइक्लिंग व बिक्री\)', r'Paper Scrap Management & Recycling Sales'),

        # StockMatrixView.tsx
        (r'मुख्य मेनू \(Back to Menu\)', r'Main Menu (Back to Menu)'),

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
    'src/components/views/QCView.tsx',
    'src/components/views/AnalyticsView.tsx',
    'src/components/views/StockMatrixView.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

