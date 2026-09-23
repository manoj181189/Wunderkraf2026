/**
 * =========================================================================
 * WÜNDERKRAF PAPERWARE ERP - OFFICIAL 100% FREE AUTOMATED DISPATCH SCRIPT
 * =========================================================================
 * 
 * This Google Apps Script acts as your private, 100% FREE Webhook listener
 * for all Shift Changeover Reports, Job Status Updates, Machine Alerts,
 * and Dispatch Notes sent from Wünderkraf Factory ERP.
 * 
 * ZERO FEES. ZERO THIRD-PARTY MONTHLY RENTALS.
 * 
 * -------------------------------------------------------------------------
 * HOW TO INSTALL IN 3 MINUTES:
 * -------------------------------------------------------------------------
 * 1. Open Google Sheets (create a sheet named "Wünderkraf Factory Audit")
 * 2. In top menu, click: Extensions > Apps Script
 * 3. Replace all existing text in Code.gs with this entire script
 * 4. (Optional) If you have a free WhatsApp gateway (like CallMeBot or Meta Free Tier),
 *    fill in your API key in the CONFIG section below. If left empty, it will log all
 *    reports automatically to your Google Sheet!
 * 5. Click "Deploy" (top right blue button) > "New deployment"
 * 6. Click the gear icon (⚙️) next to "Select type" and choose "Web app"
 * 7. Set configuration:
 *    - Description: "Wünderkraf ERP WhatsApp Bridge"
 *    - Execute as: "Me" (<your-email>)
 *    - Who has access: "Anyone" (CRITICAL: Must be "Anyone" so ERP can POST without login prompt)
 * 8. Click "Deploy", review/grant Google permissions if asked.
 * 9. Copy the "Web app URL" (ends in /exec) and paste it into Wünderkraf ERP's
 *    WhatsApp Communication Desk > "Notification Triggers & Gateway" > Webhook URL field.
 * =========================================================================
 */

// =========================================================================
// CONFIGURATION (Optional - 100% Free WhatsApp Gateways)
// =========================================================================
// Option A: CallMeBot Free WhatsApp API
// To get free API key: Send WhatsApp message "I allow callmebot to send me messages"
// to +34 644 10 55 84 from your mobile number. It replies with your free API key!
var CALLMEBOT_API_KEY = ""; // e.g. "1234567"

// Option B: Official Meta WhatsApp Cloud API (Free Tier: 1,000 conversations/month Free)
// If you set up Meta Developers, paste credentials here:
var META_ACCESS_TOKEN = ""; 
var META_PHONE_NUMBER_ID = "";

/**
 * Handles incoming POST requests from Wünderkraf ERP
 */
function doPost(e) {
  try {
    var rawContents = e.postData ? e.postData.contents : "";
    var data = rawContents ? JSON.parse(rawContents) : {};

    var phone = String(data.phone || "").replace(/[^0-9]/g, "");
    var message = data.message || "Wünderkraf Shift Update";
    var category = data.category || "GENERAL";
    var sender = data.sender || "Wünderkraf ERP";
    var timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // 1. AUTOMATIC GOOGLE SHEET LOGGING (Permanent Audit Record)
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var sheet = ss.getSheetByName("ERP_Dispatch_Logs");
      if (!sheet) {
        sheet = ss.insertSheet("ERP_Dispatch_Logs");
        sheet.appendRow(["Timestamp (IST)", "Phone Number", "Category", "Sender", "Message Preview", "Status"]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#0f766e").setFontColor("#ffffff");
      }
      sheet.appendRow([timestamp, phone, category, sender, message, "PROCESSED"]);
    }

    // 2. DISPATCH VIA FREE WHATSAPP GATEWAYS (IF CONFIGURED)
    var dispatchStatus = "LOGGED_TO_SHEET";

    // A. Dispatch via CallMeBot Free API
    if (CALLMEBOT_API_KEY && phone) {
      try {
        var callMeBotUrl = "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(phone) +
                           "&text=" + encodeURIComponent(message) +
                           "&apikey=" + encodeURIComponent(CALLMEBOT_API_KEY);
        var res = UrlFetchApp.fetch(callMeBotUrl, { muteHttpExceptions: true });
        dispatchStatus = "SENT_VIA_CALLMEBOT";
      } catch (cErr) {
        Logger.log("CallMeBot error: " + cErr.toString());
      }
    }

    // B. Dispatch via Meta Cloud API (Official Free Tier)
    if (META_ACCESS_TOKEN && META_PHONE_NUMBER_ID && phone) {
      try {
        var metaUrl = "https://graph.facebook.com/v19.0/" + META_PHONE_NUMBER_ID + "/messages";
        var metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: false, body: message }
        };
        var metaOptions = {
          method: "post",
          contentType: "application/json",
          headers: { "Authorization": "Bearer " + META_ACCESS_TOKEN },
          payload: JSON.stringify(metaPayload),
          muteHttpExceptions: true
        };
        UrlFetchApp.fetch(metaUrl, metaOptions);
        dispatchStatus = "SENT_VIA_META_CLOUD_API";
      } catch (mErr) {
        Logger.log("Meta API error: " + mErr.toString());
      }
    }

    // Return JSON response to ERP
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      status: dispatchStatus,
      timestamp: timestamp,
      phone: phone
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("doPost Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Health check GET test
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    service: "Wünderkraf Factory ERP Google Script Webhook",
    status: "online",
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
