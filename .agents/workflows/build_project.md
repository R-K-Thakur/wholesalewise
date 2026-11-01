---
name: build_project
description: Step-by-step workflow to install dependencies, typecheck, and build the WholesaleWise Next.js application.
---

# Build WholesaleWise Project

Follow these steps sequentially to compile and build the WholesaleWise application:

## 1. Verify Node.js Environment
Ensure Node.js version 20 or higher is installed:
```bash
node --version
```

## 2. Install Dependencies
Install all required npm dependencies:
```bash
npm install
```

## 3. Typecheck Code
Run TypeScript static analysis to verify type safety and catch errors:
```bash
npm run typecheck
```

## 4. Build Production Bundle
Compile the Next.js application for production:
```bash
npm run build
```
