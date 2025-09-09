# PassVault

A minimal, local-first password manager with a browser extension. All encryption happens client-side, only encrypted data is stored.

## Features
- Master password with PBKDF2 key derivation
- AES-256-GCM encryption for vault data
- IndexedDB encrypted storage
- Popup UI for unlock, search, add, copy, delete
- Optional autofill and save prompt on login forms
- Auto-lock after inactivity and manual lock
- Options page for auto-lock and theme

## Install (Chrome/Chromium)
1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click "Load unpacked" and select `extension/` in this repo.

## Usage
- Click the extension icon. Enter a master password and unlock.
- Add credentials in the popup. They are encrypted and stored locally.
- Use the Options page to configure auto-lock.

## Security Notes
- The master password is never stored. A key is derived with PBKDF2-SHA256 and a random salt.
- The vault is encrypted with AES-256-GCM. If storage is leaked, contents remain unreadable without the master password.

## Development
- No build step required; files are plain HTML/CSS/JS.
