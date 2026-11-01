---
name: preview_project
description: Step-by-step workflow to start the development preview server and test WholesaleWise.
---

# Preview WholesaleWise Project

Follow these steps to start the preview server and test the application:

## 1. Start the Development Server
Run the Next.js development server with Turbopack on port 9002:
```bash
npm run dev
```

The server will be available at:
- **Local:** `http://localhost:9002`

## 2. (Optional) Start Genkit AI Developer UI
To inspect and test Genkit AI flows locally:
```bash
npm run genkit:dev
```

## 3. Verify Application
- Open `http://localhost:9002` in your browser.
- Verify the login screen loads and all UI elements display correctly.
- Test authentication and core workflows (inventory, purchases, sales, alerts).
