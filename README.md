# Community Library Management System

A React + Vite library management system for the assignment brief. Data is stored in the browser's Local Storage.

## Features
- Dashboard with book totals, current availability, low-stock alerts, and recent transactions.
- Add, edit, search, and delete books.
- Record incoming stock and borrowed/deducted copies, with validation and transaction history.
- Add, update, and delete user accounts.
- Demo login using a registered full name and membership ID.
- React Router navigation, reusable components, controlled forms, `useState`, and `useEffect`.
- Responsive CSS layout.

## Requirements
- Node.js 18 or newer
- npm

## Run the project
1. Extract the ZIP file.
2. Open the project folder in a terminal.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL shown in the terminal.

## Demo login
- Name: `Library Admin`
- Membership ID: `ADMIN001`

## Publish to GitHub
1. Create a new empty repository on GitHub.
2. Open a terminal inside this project folder.
3. Run:
   ```bash
   git init
   git add .
   git commit -m "Create community library management system"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```
4. Replace the example remote URL with your repository URL, then submit that GitHub link.

## Note
This is a frontend coursework demo. The login is a simple local account match, not secure authentication. Data is saved in the current browser and device, not a shared online database.


## Troubleshooting
- If `npm install` fails, check that your internet connection is working and that Node.js 18 or newer is installed (`node -v`). Then run `npm install` again.
- If the browser shows a blank page, check the terminal and browser console for the first error message.
- Data is stored per browser in Local Storage. Clearing browser storage will remove the saved demo data.
