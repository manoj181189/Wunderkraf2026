import os
import re

def process_file(filepath: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    replacements = [
        # SlittingView.tsx
        (r'\(Physical Impossibility Error\)!\\n\\n` \+', r'(Physical Impossibility Error)!\n\n` +'),
        (r'`• जंबो रील इनपुट वजन: \$\{inputWeight\} KG\\n` \+', r'`• Jumbo Reel Input Weight: ${inputWeight} KG\n` +'),
        (r'`• दर्ज किया गया आउटपुट वजन: \$\{weightKg\} KG\\n\\n` \+', r'`• Entered Output Weight: ${weightKg} KG\n\n` +'),
        (r'`200 KG रॉ मटेरियल दिया तो 210 KG आउटपुट कैसे बन सकता है\? आउटपुट वजन कभी भी इनपुट वजन \(\$\{inputWeight\} KG\) से अधिक नहीं हो सकता। कम हो सकता है वेस्टेज होके।\\n\\n` \+', r'`If 200 KG raw material was given, how can output be 210 KG? Output weight can never exceed input weight (${inputWeight} KG). It can be less due to wastage.\n\n` +'),
        (r'`कृपया कांटे का सही वजन देखकर दर्ज करें!`', r'`Please check the correct scale weight and enter!`'),
        (r'`⛔ वजन असंतुलन \(Weight Balance Error\)!\n\n` \+', r'`⛔ Weight Balance Error!\n\n` +'),
        (r'`आउटपुट वजन \(\$\{weightKg\} KG\) \+ वेस्टेज स्क्रैप \(\$\{finalScrapKg\} KG\) = \$\{\(weightKg \+ finalScrapKg\)\.toFixed\(1\)\} KG\n` \+', r'`Output Weight (${weightKg} KG) + Wastage Scrap (${finalScrapKg} KG) = ${(weightKg + finalScrapKg).toFixed(1)} KG\n` +'),
        (r'`यह कुल इनपुट वजन \(\$\{inputWeight\} KG\) से अधिक है!\n\n` \+', r'`This is greater than total input weight (${inputWeight} KG)!\n\n` +'),
        (r'`कृपया सही आउटपुट और स्क्रैप वजन दर्ज करें!`', r'`Please enter correct output and scrap weight!`'),
        (r'प्रिंटेड रील:', r'Printed Reel:'),
        (r'Output Slit Rolls Count \(रोल संख्या\):', r'Output Slit Rolls Count:'),
        (r'Trim / Scrap \(KG\) \(ऑटो वेस्टेज\):', r'Trim / Scrap (KG) (Auto Wastage):'),
        (r'⛔ भौतिक रूप से असंभव \(Physical Impossibility Error\):', r'⛔ Physical Impossibility Error:'),
        (r'आउटपुट रोल वजन \(<b>(.*?) KG</b>\) इनपुट जंबो रील \(<b>(.*?) KG</b>\) से अधिक है! 200 किलो रॉ मटेरियल से 210 किलो माल नहीं निकल सकता। यह एंट्री सेव नहीं हो सकती। कृपया सही कांटा वजन दर्ज करें।', r'Output roll weight (<b>\1 KG</b>) exceeds input jumbo reel (<b>\2 KG</b>)! 200kg raw material cannot produce 210kg goods. Entry cannot be saved. Please enter correct scale weight.'),
        (r'title={parsedOutWeight > activeInputWeight \? \'भौतिक रूप से असंभव: आउटपुट वजन इनपुट से अधिक है!\' : \'Finish and record slit rolls\'}', r'title={parsedOutWeight > activeInputWeight ? \'Physical impossibility: Output weight exceeds input!\' : \'Finish and record slit rolls\'}'),
        (r'🔒 Single Active Job Policy \(सिंगल एक्टिव जॉब प्रतिबंध\):', r'🔒 Single Active Job Policy:'),
        (r'मशीन <b>Slitting-1</b> पर वर्तमान में जॉब <b>\[(.*?)\]</b> एक्टिव रनिंग है। एक समय में केवल एक ही जॉब रन हो सकता है। नया जॉब शुरू करने से पहले वर्तमान जॉब को \'Hold\' या \'Complete\' करें, अथवा <b>बिना जॉब रोके</b> इसी एक्टिव जॉब में नया रील Add-on करें:', r'Job <b>[\1]</b> is currently active running on machine <b>Slitting-1</b>. Only one job can run at a time. Hold or Complete current job before starting a new one, or add-on new reel to this active job <b>without stopping</b>:'),
        (r'Link Production Plan \(PPC\) & Mother Reel \(प्लान व मदर रील लिंक करें\)', r'Link Production Plan (PPC) & Mother Reel'),
        (r'Allocate Mother Jumbo Reel \(कच्ची रील स्टॉक\):', r'Allocate Mother Jumbo Reel:'),
        (r'Roll Print Option \(रील प्रिंट प्रकार\):', r'Roll Print Option:'),
        (r'Without Printed \(प्लेन रील\)', r'Without Printed (Plain Reel)'),
        (r'Printed Roll \(प्रिंटेड रील\)', r'Printed Roll'),
        (r'Printed Brand / Design \(प्रिंटेड डिज़ाइन नाम\):', r'Printed Brand / Design Name:'),
        (r'Display Icon \(आइकॉन\):', r'Display Icon:'),
        (r'Reel Number \(रील नंबर\):', r'Reel Number:'),
        (r'उदा\. RL-ITC-1024 या बारकोड', r'e.g. RL-ITC-1024 or Barcode'),
        (r'GSM \(जीएसएम थिकनेस\):', r'GSM (Thickness):'),
        (r'Reel Remarks / Lot Note \(रिमार्क\):', r'Reel Remarks / Lot Note:'),
        (r'उदा\. Special Export Lot #992', r'e.g. Special Export Lot #992'),
        (r'`मशीन Slitting-1 पर जॉब \[\$\{currentRunningBatch\.job\.id\}\] रनिंग है। एक समय में केवल एक जॉब रन हो सकता है।`', r'`Job [${currentRunningBatch.job.id}] is running on machine Slitting-1. Only one job can run at a time.`'),
        (r'Slitting Reels & Traceability Register \(स्लिटिंग रील व जॉब आईडी रजिस्टर\)', r'Slitting Reels & Traceability Register'),
        (r'हर जॉब आईडी में प्रयुक्त रील नंबर, जीएसएम व आगे की स्टेज की ट्रेसेबिलिटी स्थिति', r'Reel number, GSM used in each Job ID and onward stage traceability status'),
        (r'Date \(तारीख\)', r'Date'),
        (r'Reel No\. \(रील नंबर\)', r'Reel No.'),
        (r'GSM \(जीएसएम\)', r'GSM'),
        (r'Traceability \(ट्रेसेबिलिटी\)', r'Traceability'),
        (r'title="ट्रेसेबिलिटी में देखें कि यह रील कहाँ-कहाँ पहुँची"', r'title="See where this reel reached in Traceability"'),
        (r'⚠️ <b>सिंगल एक्टिव जॉब सूचना:</b> मशीन Slitting-1 पर अभी जॉब <b>(.*?)</b> रनिंग स्थिति में है। जब तक वह Hold या Complete नहीं होता, तब तक केवल उसी एक्टिव जॉब <b>(.*?)</b> में नई रील/एंट्री ऐड-ऑन की जा सकती है।', r'⚠️ <b>Single Active Job Info:</b> Job <b>\1</b> is currently running on machine Slitting-1. Until it is Held or Completed, new reel/entry can only be added-on to this active job <b>\2</b>.'),
        (r'💡 यदि आप अलग GSM \(उदा\. 300 GSM\) की रील जोड़ रहे हैं, तो नीचे GSM फील्ड में नया GSM लिखें। जॉब कार्ड में दोनों GSM अलग-अलग सुरक्षित रहेंगे और आगे कटिंग व फॉर्मिंग में दिखेंगे!', r'💡 If adding a reel of different GSM (e.g. 300 GSM), enter new GSM below. Both GSMs will remain separate in Job Card and visible in cutting & forming!'),

        # QCView.tsx
        (r'`• पहले थे: \$\{prevQty\} क्रेट्स\\n` \+', r'`• Previously: ${prevQty} Crates\n` +'),
        (r'`• नए दिए: \+\$\{cratesCount\} क्रेट्स\\n` \+', r'`• Newly Given: +${cratesCount} Crates\n` +'),
        (r'`• कुल हाथ में क्रेट्स \(Total in Hand\): \$\{newTotalQty\} क्रेट्स\\n\\n` \+', r'`• Total in Hand: ${newTotalQty} Crates\n\n` +'),
        (r'`• जोड़े गए: \+\$\{addCount\} क्रेट्स\\n` \+', r'`• Added: +${addCount} Crates\n` +'),
        (r'`• अब कुल हाथ में क्रेट्स \(Total in Hand\): \$\{newTotal\} क्रेट्स\\n\\n` \+', r'`• Total in Hand Now: ${newTotal} Crates\n\n` +'),

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
    'src/components/views/SlittingView.tsx',
    'src/components/views/QCView.tsx',
    'src/components/LiveFloorManpowerTracker.tsx'
]

for filepath in files_to_process:
    if os.path.exists(filepath):
        process_file(filepath)

