# PassVault — Browser Extension Password Manager

## 1. What is the project?

PassVault is a browser extension that securely stores and retrieves credentials (usernames & passwords) for websites and applications.  
All encryption and decryption happen **locally in the browser** — even if the storage (IndexedDB) were compromised, attackers would only ever see encrypted data.  

Key capabilities include:  
- Master password protection  
- Automatic lock after inactivity + manual lock  
- Add / edit / delete credentials  
- Autofill, search, copy credentials from context menu or saved vault  
- Prompt to save credentials when entering new ones on a site  

---

## 2. Tech Stack & Security Design

### Frontend (Browser Extension UI)

- **Popup UI**: Unlock vault, search saved credentials, and add new ones  
- **Content Script (optional)**: Detects login forms and injects auto-fill functionality  
- **Service Worker / Background Script**: Maintains vault state; handles background tasks like encryption / decryption and responding to extension events  

### Storage

- **Local Storage**: Uses **IndexedDB** for storing encrypted vault / credentials  

### Encryption & Security

- **Master Password & Key Derivation**  
  - User sets a master password (never stored anywhere in plaintext)  
  - A cryptographic key is derived from master password using PBKDF2 (or equivalent strong KDF)  

- **Local AES Encryption**  
  - Uses **AES-256-GCM** (which provides confidentiality *and* integrity checks)  
  - All credentials stored encrypted in IndexedDB  

- **Auto-Lock & Manual Lock**  
  - Vault auto-locks after a period of inactivity  
  - Manual lock button always available to immediately lock  

- **Password Generator**  
  - Generates strong random passwords using secure randomness (e.g. `crypto.getRandomValues()` in JS)  
  - Supports custom settings: length, symbols, numbers, etc.  

---

## 3. Features

Here are the features implemented in PassVault:

- Set a **Master Password**, which unlocks access to all saved credentials  
  ![](./snapshots/master.png)  

- Automatically lock the vault after a period of inactivity  

- Add new credentials: **Website**, **Username**, **Password**  
  ![](./snapshots/ownpassword.png)  

- **Generates strong passwords:** Creates random passwords containing **lowercase**, **uppercase**, **numbers**, and **special characters**.  
  ![](./snapshots/generate.png)  

- Edit, copy, or delete saved credentials  
  ![](./snapshots/lock.png)  

- Search through saved credentials (by website or username)  
  ![](./snapshots/search.png)  

- Manually lock the vault with a **Lock** button  

- **Auto-fill** login forms on websites where credentials are saved  
  ![](./snapshots/autofill.png)  

- Context menu integration: Right-click in a username/password field → choose PassVault to fill saved credentials  
  ![](./snapshots/right-click.png)  

- Prompt to save credentials when user enters a new login on a website (if not already saved) — helps avoid saving wrong or partial info  
  ![](./snapshots/confirm.png)  

  

---

## 4. File Structure

Below is a sample structure of the project; actual file names / folders might vary.

- `README.md`
- `extension/`
  - `background.js`
  - `content.js`
  - `manifest.json`
  - `options.css`
  - `options.html`
  - `options.js`
  - `popup.css`
  - `popup.html`
  - `popup.js`
  - `assets/`
    - `icon.svg`
  - `scripts/`
    - `crypto.js`
    - `generator.js`
    - `storage.js`
- `snapshots/`
  - `autofill.png`
  - `confirm.png`
  - `generate.png`
  - `homepage.png`
  - `lock.png`
  - `master.png`
  - `ownpassword.png`
  - `right click.png`
  - `Screenshot 2025-09-12 230312.png`
  - `Screenshot 2025-09-12 230403.png`
  - `search.png`
---

## 5. Installation & Setup

Since this extension is not published on any browser store, you’ll need to load it manually in **developer mode**.

1. **Download / Clone**  
   - Clone the repo:  
     ```bash
     git clone https://github.com/Cyber-Security-July-Dec-2025/B3.git
     ```
   - Or download ZIP via GitHub → Code → Download ZIP  

2. **Extract** (if ZIP) → you’ll have a folder, e.g. `passvault/`  

3. **Load the Extension in Browser**

   **Google Chrome**  
   - Go to `chrome://extensions`  
   - Enable **Developer mode** (toggle top-right)  
   - Click **Load unpacked**  
   - Select the `extension` folder inside your project  

   **Microsoft Edge**  
   - Go to `edge://extensions`  
   - Enable **Developer mode**  
   - Click **Load unpacked**  
   - Select the `extension` folder  

4. **Pin the extension**  
   - After installing, click the puzzle-piece icon in the browser toolbar  
   - Pin *PassVault* for easy access  

---

## 6. Usage

- Unlock vault using your Master Password  
- Add new credentials (Website, Username, Password)  
- Generate strong password when needed (adjust length / symbols etc.)  
- Use the Search box to find saved credentials  
- Use the Lock button to secure vault immediately  
- Visit a website with saved credentials → the extension auto-fills the login form  
- On a site where credentials are *not* saved: after you manually login, you’ll get a prompt asking if you want to save credentials in PassVault  

---

## 7. Security & Best Practices

- **Local-Only Encryption**: No sensitive data leaves the browser (everything is encrypted on the client side)  
- **AES-256-GCM**: Provides both confidentiality & integrity of stored credentials  
- **Key Derivation (PBKDF2)**: Ensures your master password is stretched into a strong key  
- **Auto-Lock + Manual Lock**: Helps prevent unauthorized access if you leave your system/browser open  

---

## 8. Group Members

| Name | Roll / ID |
|---|---|
| Manik Chadgal | IIT2023119 |
| Love Bansal | IIT2023121 |
| Shwet Kumar | IIT2023142 |
| Akshat Supat | IIT2023207 |

---
