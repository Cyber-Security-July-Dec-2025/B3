# PassVault – Web App & Browser Extension  

PassVault is a **secure password manager** that lets you safely store and retrieve passwords for websites and applications.  
All encryption happens **locally inside the browser extension**, so even if the database is leaked, attackers only see **encrypted data**.  

---

## 🔧 Tech Stack  

**Frontend (Browser Extension UI):**  
- **Popup UI:** Unlock vault, search, and add credentials.    
- **Content Script:** Detects login forms and injects autofill logic.  
- **Background Script:** Handles encryption/decryption and vault state.  

**Storage:**  
- **IndexedDB** for storing the encrypted vault.  

---

## ✨ Features  

- **Master Password & Key Derivation**  
  - User sets a master password (never stored).  
  - Strong key derived via PBKDF2, Argon2, or scrypt.  
  - This key encrypts/decrypts all saved credentials.  

- **Local AES Encryption**  
  - Uses **AES-256-GCM** for secure encryption + integrity checks.  
  - All data stored in **encrypted form** in IndexedDB.  


- **Password Generator**  
  - Creates strong random passwords with symbols, numbers, and custom length.  
  - Built using `crypto.getRandomValues()` in JavaScript.  

- **Security Features**  
  - Auto-lock after inactivity.  
  - Manual lock option for quick security.  


### Data Flow Diagram (DFD)

This diagram shows how data moves through the system during a single round of authentication.

![Data Flow Diagram for Authentication](./diagrams/DFD.jpeg)

1.  *Challenge:* Alice sends a challenge $c$ to Bob.
2.  *Response:* Bob uses $c$ to find the correct hash $h_{n-c}$ in his pre-computed chain and sends it back.
3.  *Verification:* Alice computes $H(h_{n-c})$ and checks if it matches her stored value. If it does, the round is successful.

---
### Installation

Since this extension is not on the official web stores, you will need to load it manually in developer mode.

-   **Download:** Download the project from GitHub by clicking `Code` > `Download ZIP`, or by cloning the repository.
-   **Unzip:** Extract the downloaded ZIP file. You should now have a folder named `passvault`.
-   **Load the Extension:**

    #### **Google Chrome 🌐**

    1.  Open Chrome and navigate to `chrome://extensions`.
    2.  In the top-right corner, enable **Developer mode**.
    3.  Click the **Load unpacked** button that appears.
    4.  In the file selection window, navigate to the `passvault` folder and select the `extension` sub-folder.
    5.  Click **Select Folder**.

    #### **Microsoft Edge 엣**

    1.  Open Edge and navigate to `edge://extensions`.
    2.  In the bottom-left corner, enable **Developer mode**.
    3.  Click the **Load unpacked** button.
    4.  In the file selection window, navigate to the `extension` folder and select the `extension` sub-folder.
    5.  Click **Select Folder**.

#
- **Pin the Extension:** After installation, click the puzzle piece icon (🧩) in your browser's toolbar and pin PassVault for easy access.

---

## How To Use
- There will be popup like shown in image for very first time set a master password which will be further required to access all saved passwords in future.
##  There are two ways to use the extension and save password in it:
## Saving Password in Vault
- Directly in Extension
- Pop up to choose to save password while logging in some website
## Using the Saved Password
