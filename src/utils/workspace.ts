import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

// In-memory access token cache (NOT stored in localStorage/sessionStorage as per safety rules)
let cachedAccessToken: string | null = null;

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string): void => {
  cachedAccessToken = token;
};

export const clearCachedAccessToken = (): void => {
  cachedAccessToken = null;
};

/**
 * Triggers Google Sign-In to obtain the access token with requested scopes.
 */
export const acquireGoogleAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  if (!auth || !googleProvider) {
    throw new Error("Google Authentication is not initialized properly.");
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to obtain Google Access Token.");
    }
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (error: any) {
    console.error("Error acquiring access token:", error);
    throw error;
  }
};

/**
 * Encodes string to safe base64url format.
 */
function base64urlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Constructs a raw MIME message for the Gmail API.
 */
function buildMimeMessage(toEmails: string[], subject: string, bodyHtml: string): string {
  const toStr = toEmails.join(", ");
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const base64Body = btoa(unescape(encodeURIComponent(bodyHtml)));

  const parts = [
    `To: ${toStr}`,
    `Subject: ${utf8Subject}`,
    "Mime-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Body
  ];

  return base64urlEncode(parts.join("\r\n"));
}

/**
 * Sends a notification email to the workspace admins using the Gmail API.
 */
export const sendGmailNotification = async (
  accessToken: string,
  request: { name: string; email: string; startDate: string; endDate: string; reason: string; leaveType: string },
  adminEmails?: string[]
): Promise<void> => {
  const admins = adminEmails && adminEmails.length > 0 ? adminEmails : [
    "htooaung.lin@code-byte.io",
    "ju.zaw@code-byte.io",
    "samson@code-byte.io",
    "yehtet.zaw@code-byte.io"
  ];

  const subject = `[Leave Notification] ${request.name} - ${request.leaveType}`;

  const bodyHtml = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 40px;">📅</span>
        <h2 style="color: #0f172a; margin-top: 12px; margin-bottom: 4px; font-weight: 800; font-size: 20px;">Team Leave Notification</h2>
        <p style="font-size: 13px; color: #64748b; margin: 0;">This request has been automatically registered and is active immediately.</p>
      </div>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; font-weight: 700; color: #475569; width: 35%;">Employee</td>
            <td style="padding: 8px 0; color: #0f172a;">${request.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 700; color: #475569;">Email</td>
            <td style="padding: 8px 0; color: #64748b; font-family: monospace;">${request.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 700; color: #475569;">Leave Type</td>
            <td style="padding: 8px 0; color: #0f172a;">
              <span style="background-color: #e0e7ff; color: #4338ca; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
                ${request.leaveType}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 700; color: #475569;">Duration</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">
              ${request.startDate} &nbsp;➔&nbsp; ${request.endDate}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 700; color: #475569; vertical-align: top;">Notes / Reason</td>
            <td style="padding: 8px 0; color: #334155; line-height: 1.4;">${request.reason || "N/A"}</td>
          </tr>
        </table>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          Sent automatically via Google Workspace API integration.
        </p>
      </div>
    </div>
  `;

  const rawMessage = buildMimeMessage(admins, subject, bodyHtml);

  const res = await fetch("https://gmail.googleapis.com/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: rawMessage })
  });

  if (!res.ok) {
    const errorDetails = await res.text();
    console.error("Gmail send error:", errorDetails);
    throw new Error(`Gmail delivery failed: ${res.statusText}`);
  }
};

/**
 * Searches for or creates a spreadsheet in Drive, then appends a leave request row.
 */
export const syncToGoogleSheets = async (
  accessToken: string,
  request: { name: string; email: string; startDate: string; endDate: string; reason: string; leaveType: string }
): Promise<string> => {
  // 1. Search Google Drive for spreadsheet
  const q = encodeURIComponent("name = 'CodeByte Leave Requests' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    throw new Error(`Drive search failed: ${searchRes.statusText}`);
  }

  const searchData = await searchRes.json();
  let spreadsheetId = "";
  let isNew = false;

  if (searchData.files && searchData.files.length > 0) {
    spreadsheetId = searchData.files[0].id;
  } else {
    // 2. Create spreadsheet if missing
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: { title: "CodeByte Leave Requests" }
      })
    });

    if (!createRes.ok) {
      throw new Error(`Spreadsheet creation failed: ${createRes.statusText}`);
    }

    const createData = await createRes.json();
    spreadsheetId = createData.spreadsheetId;
    isNew = true;
  }

  // 3. Populate headers if new sheet
  if (isNew) {
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`;
    await fetch(headerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [["Employee Name", "Email", "Start Date", "End Date", "Leave Type", "Reason / Notes", "Logged At"]]
      })
    });
  }

  // 4. Append request row
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:G:append?valueInputOption=RAW`;
  const appendRes = await fetch(appendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [[
        request.name,
        request.email,
        request.startDate,
        request.endDate,
        request.leaveType,
        request.reason,
        new Date().toLocaleString()
      ]]
    })
  });

  if (!appendRes.ok) {
    throw new Error(`Failed to append spreadsheet data: ${appendRes.statusText}`);
  }

  return spreadsheetId;
};
