import { jsPDF } from "jspdf";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function generateCodeBytePolicyPdf() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Attempt to load CodeByte PNG logo
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage("/codebyte.png");
  } catch (err) {
    console.warn("Could not load /codebyte.png for PDF, falling back to styled block", err);
  }

  // Colors
  const darkBg = "#0F172A"; // slate-900
  const primaryColor = "#4F46E5"; // indigo-600
  const textColor = "#334155"; // slate-700
  const headingColor = "#0F172A"; // slate-900
  const lightBg = "#F8FAFC"; // slate-50
  const borderColor = "#E2E8F0"; // slate-200

  // Header Helper
  const addHeaderFooter = (pageNo: number, totalPages: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#94A3B8");
    doc.text("CodeByte Company Limited — Employee Attendance, Working Hours & Leave Policy", margin, 12);
    doc.text("Doc ID: Cod/POL/01", pageWidth - margin, 12, { align: "right" });
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 15, pageWidth - margin, 15);

    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.text("CONFIDENTIAL — FOR INTERNAL USE ONLY", margin, pageHeight - 10);
    doc.text(`Page ${pageNo} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  };

  // PAGE 1: COVER
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Employee Attendance, Working Hours, and Leave Policy (Confidential)", pageWidth / 2, 25, { align: "center" });

  if (logoImg) {
    // Draw dark background box and embed actual CodeByte PNG image
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, 55, contentWidth, 75, "F");

    // Maintain aspect ratio for PNG logo inside banner
    const targetW = contentWidth - 10;
    const targetH = (logoImg.naturalHeight / logoImg.naturalWidth) * targetW;
    const clampedH = Math.min(targetH, 65);
    const clampedW = clampedH * (logoImg.naturalWidth / logoImg.naturalHeight);
    const imgX = (pageWidth - clampedW) / 2;
    const imgY = 55 + (75 - clampedH) / 2;

    doc.addImage(logoImg, "PNG", imgX, imgY, clampedW, clampedH);
  } else {
    // Fallback if image load fails
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, 55, contentWidth, 75, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("CodeByte", pageWidth / 2, 90, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(199, 210, 254);
    doc.text("COMPANY LIMITED", pageWidth / 2, 100, { align: "center" });
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("< Employee Attendance, Working Hours, and Leave Policy >", pageWidth / 2, 155, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Document ID: <Cod/POL/01>", pageWidth / 2, 180, { align: "center" });
  doc.text("Effective Date: 16/02/2026 | Version V1.0", pageWidth / 2, 187, { align: "center" });

  // Document Control Box at bottom of page 1
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 210, contentWidth, 45, 3, 3, "FD");

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("DOCUMENT CONTROL INFORMATION", margin + 5, 218);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Prepared By: Samson Paing Minn", margin + 5, 226);
  doc.text("Reviewed By: Ju Zaw, Ye Htet Zaw, Samson Paing Min", margin + 5, 233);
  doc.text("Approved By: Samson Paing Minn", margin + 5, 240);
  doc.text("Target Audience: All Department Employees (CodeByte Company Limited)", margin + 5, 247);

  addHeaderFooter(1, 3);

  // PAGE 2: POLICY CONTENT
  doc.addPage();
  addHeaderFooter(2, 3);

  let y = 25;

  const drawSectionTitle = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(title, margin, y);
    y += 7;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 4;
  };

  const drawParagraph = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 3;
  };

  const drawBullet = (boldPrefix: string, normalText: string) => {
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text("•  " + boldPrefix + " ", margin + 3, y);
    const prefixWidth = doc.getTextWidth("•  " + boldPrefix + " ");

    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(normalText, contentWidth - prefixWidth - 3);
    doc.text(lines, margin + 3 + prefixWidth, y);
    y += Math.max(1, lines.length) * 5 + 2;
  };

  drawSectionTitle("1. Introduction & Objective");
  drawParagraph("This policy defines the rules governing employee attendance, working hours, punctuality, and leave entitlements at CodeByte Company Limited. It establishes clear expectations and procedures to ensure operational continuity, accountability, and fair treatment across all departments.");

  drawSectionTitle("2. Policy Applicability & Scope");
  drawParagraph("This policy applies to all permanent, contract, and probationary employees in all departments and business units regardless of role or seniority, unless explicitly stated otherwise in an individual employment agreement.");

  drawSectionTitle("3. Working Hours & Punctuality");
  drawBullet("Official Working Hours:", "9:00 a.m. to 5:00 p.m., Monday to Friday. Employees must be present and performing duties during these hours.");
  drawBullet("Lateness Threshold:", "Arrivals more than 15 minutes past 9:00 a.m. are officially classified as 'Lateness'.");
  drawBullet("Attendance Record:", "Informing managers or colleagues via group chat or verbal communication does NOT constitute formal leave approval.");
  drawBullet("Lateness Penalties:", "Repeated lateness or early departures are subject to verbal/written warnings, leave deductions, or disciplinary action up to termination.");

  y += 3;
  drawSectionTitle("4. Leave Entitlements Summary");

  // Entitlements Table
  const tableX = margin;
  const colWidths = [35, 30, 105];
  const headers = ["Leave Type", "Quota / Year", "Key Terms & Guidelines"];

  doc.setFillColor(241, 245, 249);
  doc.rect(tableX, y, contentWidth, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(headers[0], tableX + 3, y + 5.5);
  doc.text(headers[1], tableX + colWidths[0] + 3, y + 5.5);
  doc.text(headers[2], tableX + colWidths[0] + colWidths[1] + 3, y + 5.5);
  y += 8;

  const rows = [
    ["Paid Annual Leave", "10 Days", "Must be applied & approved in advance. Eligible for refund if not taken during the calendar year."],
    ["Casual / Urgent Leave", "6 Days", "Granted with full salary for urgent matters. Subject to management approval. Non-refundable."],
    ["Unpaid Leave", "20 Days", "Subject to management discretion & business requirements. Non-refundable."],
    ["Medical Leave", "24 Days", "2 days/month guideline (up to 24 days/yr). Valid medical certificate required for >1 day. Non-refundable."]
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(tableX, y, contentWidth, 12, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(tableX, y, contentWidth, 12, "S");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(row[0], tableX + 3, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.text(row[1], tableX + colWidths[0] + 3, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const descLines = doc.splitTextToSize(row[2], colWidths[2] - 5);
    doc.text(descLines, tableX + colWidths[0] + colWidths[1] + 3, y + 5);

    y += 12;
  });

  // PAGE 3: GUIDELINES & DISCIPLINARY
  doc.addPage();
  addHeaderFooter(3, 3);
  y = 25;

  drawSectionTitle("5. Leave Application & Approval Procedure");
  drawParagraph("1. All leave requests must be formally submitted through the official CodeByte Leave Portal prior to the leave start date.");
  drawParagraph("2. Leave is considered officially approved ONLY upon explicit confirmation from management or HR in the portal.");
  drawParagraph("3. In emergency situations, employees must notify line managers as soon as reasonably possible and submit formal documentation retrospectively upon return.");
  drawParagraph("4. Proration Rule: For employees who join mid-year, leave entitlements will be prorated based on months of service and rounded down to the nearest whole day (e.g., 2.4 days = 2 days).");

  drawSectionTitle("6. Medical Documentation Requirement");
  drawParagraph("A valid medical certificate / doctor's note from a registered medical practitioner is required for medical leave exceeding one (1) consecutive day. Attachments must be uploaded directly in the Leave Portal during request or log.");

  drawSectionTitle("7. Disciplinary Framework & Management Rights");
  drawParagraph("Unauthorised absence (failure to report without prior approval or retroactive filing without emergency justification) constitutes misconduct.");
  drawBullet("Disciplinary Sequence:", "Verbal warning -> Written warning -> Final written warning -> Suspension -> Termination of Employment.");
  drawParagraph("CodeByte Company Limited reserves the right to amend this policy, approve or reject leave requests based on operational requirements, and take disciplinary action to protect business interests.");

  drawSectionTitle("8. Employee Acknowledgement");
  drawParagraph("All employees are required to read, understand, and comply with this policy. Non-compliance cannot be excused by lack of awareness.");

  // Footer stamp
  y = Math.max(y + 10, 220);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentWidth, 30, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("CodeByte Company Limited — HR & Management", margin + 6, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Official Document ID: Cod/POL/01 | Effective Date: 16/02/2026", margin + 6, y + 17);
  doc.text("For questions or clarification regarding this policy, contact HR at hr@codebyte.com.", margin + 6, y + 23);

  // Trigger download
  doc.save("CodeByte_Leave_Policy_Cod_POL_01.pdf");
}
