# 📚 CodeByte Leave Management Portal

A full-stack, enterprise-ready employee leave management system engineered for **CodeByte**. Features real-time Firestore synchronization, intelligent working-day calculations with Myanmar gazetted public holidays, predictive team coverage radar, CSV spreadsheet export, and official policy PDF generation.

---

## 🚀 Quick Deployment Guide (GitHub & Vercel)

> **Can I just download the whole code, upload to GitHub, and connect to Vercel?**
> 
> **YES, absolutely!** Follow the 4 simple steps below to get your app running on Vercel with automated CI/CD deployments.

---

### Step 1: Download & Prepare Your Code
1. In Google AI Studio, export or download the repository folder/zip.
2. Extract the files on your local computer.

---

### Step 2: Push to GitHub
Open your terminal in the extracted project root directory and run:

```bash
# 1. Initialize git repository
git init

# 2. Add all project files
git add .

# 3. Create your initial commit
git commit -m "feat: initial commit for CodeByte portal"

# 4. Set your main branch
git branch -M main

# 5. Link your GitHub remote repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# 6. Push to GitHub
git push -u origin main
```

---

### Step 3: Deploy to Vercel
1. Go to [Vercel](https://vercel.com) and log in.
2. Click **"Add New"** > **"Project"**.
3. Import your GitHub repository (`YOUR_REPOSITORY`).
4. Vercel will automatically detect the settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Click **"Deploy"**. Vercel will build and deploy your application in under a minute!

> **Note on Routing:** A `vercel.json` file is already included in this repository with SPA URL rewrites (`/index.html`) so refreshing on any route works seamlessly without 404 errors.

---

### Step 4: Add Vercel Domain to Firebase Authorized Domains (CRITICAL)
For Google Sign-In and Firebase Authentication to work on your Vercel deployment:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select the project: `codebyteprojecttracker`.
3. Go to **Build** > **Authentication** > **Settings** tab.
4. Scroll down to **Authorized domains**.
5. Click **"Add domain"** and enter your Vercel production domain:
   - Example: `your-project-name.vercel.app`
6. Click **Save**. Google Sign-In will now authenticate seamlessly from your Vercel URL!

---

## 💻 Local Development

To run the application locally on your machine:

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```

The dev server will run on `http://localhost:3000`.

---

## 🌟 Key Application Features

### 🌴 1. Intelligent Leave Request System
* **Flexible Leave Types & Durations**: Supports Full Day, AM Half Day, and PM Half Day across Annual Leave (10 days/yr), Casual Leave (6 days/yr), Medical Leave (24 days/yr), Urgent Leave, and Unpaid Leave.
* **Myanmar Gazetted Public Holiday Integration**:
  - Automatically calculates net working days by excluding weekends (Saturdays & Sundays) and gazetted Myanmar public holidays (Thingyan, Waso Full Moon, Thadingyut, Tazaungdaing, Independence Day, Union Day, etc.).
* **🛡️ Team Coverage & Overlap Warning Detector**:
  - **Real-Time Overlap Detection**: Detects overlapping leave dates with other team members in real-time before submission.
  - **Capacity Threshold Alerts**: Warns users and managers if team capacity drops below 60%.
  - **60-Day Predictive Radar**: Visual timeline highlighting upcoming dates where 2+ members are scheduled away.
* **📊 Download CSV Feature for Admins**:
  - Export filtered leave history directly to a spreadsheet-ready `.csv` file compatible with Microsoft Excel, Apple Numbers, and Google Sheets.
  - Columns strictly match company audit standards: `Name`, `Leave Type`, `Start Date`, `End Date`, `Reason`, `AM/PM/Full Day`, `Working Days`.
  - Dates are automatically formatted with the day of the week and full month name (e.g. `Tuesday, September 29, 2026`).
  - Supports filtering by Employee, Leave Type, Status (Approved/Pending/Denied), Year, or Search keyword before exporting.
  - Generates UTF-8 encoded files with BOM to ensure Burmese characters and special symbols display cleanly in Excel.
* **📅 Multi-Year Audit & Annual Reset**:
  - Filter leave records across 2024, 2025, 2026, 2027, or All Time.
  - Live quota tracker with visual progress bars and annual quota warnings.
* **📄 Official CodeByte Leave Policy PDF**:
  - Built-in PDF generator creating the official document: **"CodeByte Employee Attendance, Working Hours & Leave Policy" (Doc ID: Cod/POL/01)**.
* **Log Historical Leave (Admins Only)**:
  - Backdate leave records from before application launch with automatic holiday deduction and quota checks.

---

### 👥 2. Team Management & Security
* **Multi-Admin Privilege Control**: Designated administrators can approve/reject leaves, edit submitted forms, manage team rosters, and export audit spreadsheets.
* **Persistence & Fallback**: Real-time Firebase Firestore database with offline IndexedDB persistence and automatic local storage fallback.
* **Clean UI & Responsive Design**: Built with Tailwind CSS, custom color palettes, dark mode support, and smooth micro-interactions via `motion/react`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 6 |
| **Styling & Animation** | Tailwind CSS v4, Motion (`motion/react`), Lucide React |
| **Persistence & Auth** | Firebase Firestore, Firebase Authentication, IndexedDB |
| **Document & Data Export** | jsPDF (Policy PDF Generation), Client-Side RFC-4180 CSV Engine |
| **Hosting & CI/CD** | Vercel (Production) / Google AI Studio (Prototyping) |

---

## 📄 License & Credits
Proprietary software built for **CodeByte Workspace**. All rights reserved.
