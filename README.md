# 🦁 Project Leo — Local Network File Manager

> **Access, browse, stream, and manage your PC files from any device on your WiFi — no cables, no cloud, no internet required.**

![Version](https://img.shields.io/badge/version-1.0-orange?style=flat-square)
![Python](https://img.shields.io/badge/python-3.7+-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![No Install](https://img.shields.io/badge/no%20app%20install-required-brightgreen?style=flat-square)

---

## 📖 What is Project Leo?

Project Leo turns your Windows PC into a **personal file server** on your home or office WiFi network.

Once you start it, you can open a browser on **any device** — your Android phone, iPhone, iPad, laptop, or smart TV — and instantly access everything on your PC. Browse folders, watch videos, listen to music, download files, upload photos, and more.

No cables. No USB drives. No Google Drive. No Bluetooth. No apps to install on your phone. Just your WiFi and a browser.

---

## 🤔 Why is it Better Than Other Methods?

| Method | Speed | Wired? | App Needed? | Works on All Devices? | Private? |
|---|---|---|---|---|---|
| **Project Leo** | ⚡ WiFi Speed | ❌ No | ❌ No | ✅ Yes | ✅ 100% Local |
| USB Cable | 🐢 Slow setup | ✅ Yes | Sometimes | ❌ No | ✅ Yes |
| Bluetooth | 🐌 Very slow | ❌ No | Sometimes | ❌ Limited | ✅ Yes |
| Google Drive | 🐢 Upload first | ❌ No | ❌ No | ✅ Yes | ❌ Cloud |
| Pendrive/USB | 🐢 Copy twice | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| AirDroid | Medium | ❌ No | ✅ Required | ✅ Yes | ⚠️ Their Servers |

### Why Project Leo is different:

- ✅ **No app needed on your phone** — open any browser, type the IP, done
- ✅ **No internet needed** — works completely offline on local WiFi
- ✅ **No file size limit** — transfer a 100 GB video if you want
- ✅ **No waiting** — files stay on your PC and stream directly to your device
- ✅ **No subscription, no account, no ads** — free forever
- ✅ **Password protected** — other people on your WiFi cannot access your files
- ✅ **Stream videos without downloading** — watch directly in the browser
- ✅ **Works on every device** — Android, iPhone, iPad, Windows, Mac, Linux — anything with a browser

---

## ⚠️ Browser Recommendation — Important

**Use Google Chrome or Brave browser for the best experience.**

| Browser | Recommended? | Notes |
|---|---|---|
| ✅ Google Chrome | Yes — Best | Fully recommended |
| ✅ Brave | Yes — Best | Fully recommended |
| ✅ Microsoft Edge | Yes | Works perfectly |
| ✅ Safari | Yes | Good for iPhone and iPad |
| ⚠️ Mozilla Firefox | No | **Avoid for video streaming** |

**Why avoid Firefox for video?**
Firefox handles video streaming (HTTP range requests) very differently from other browsers. In Project Leo, this causes videos to load extremely slowly, stall in the middle, or show a completely black screen. All other features — file browsing, uploading, downloading, viewing images, playing audio — work fine in Firefox. But when it comes to watching videos, always switch to Chrome or Brave. This is a known browser compatibility issue and not something that can be easily fixed on the server side.

---

## ✨ Full Feature List

### 🔐 Login and Security
- Password-protected login page before accessing any files
- Username and password are set fresh every time you start the server via CMD
- Sessions are IP-bound — your login token only works from your specific device on your network. If someone copies your session token, it will not work from a different device or IP address.
- Password is SHA-256 hashed in memory — never written to any file on disk
- All sessions expire immediately when the server is stopped
- "Remember me" option to stay logged in for the current browser session

### 📁 File Browsing
- Clean grid layout showing all folders and files
- Folders and files sorted alphabetically, folders first
- File size shown under every file
- Search bar to filter files by name in the current folder
- Breadcrumb navigation showing your full path — click any part to jump back
- Long-press (mobile) or right-click (desktop) any file or folder for a context menu with: Download, Rename, Move to, Select, Delete

### 💾 Multi-Drive Support
- Automatically detects all drives on your PC at startup — C:, D:, E:, G:, USB drives, external hard drives
- The CMD window shows all drives and their free space when you start
- In the browser, click the drive chip (shows `D: ▾`) in the breadcrumb bar
- A dropdown appears showing every drive with its free space
- Switch to any drive instantly without restarting the server
- The disk usage bar at the bottom shows used space, total space, and free space for the active drive

### ☑️ Multi-Select and Bulk Actions
- Tap the select icon in the toolbar to enter selection mode
- Tap any file or folder to select it — selected items get a blue checkmark
- Tap "Select All" to select everything in the current folder
- Action bar appears at the top showing how many items are selected
- From the action bar: bulk download as ZIP, move all to another folder, or delete all in one tap
- Right-click selected items on desktop for the same options

### 📦 ZIP Download with Live Progress
- Download any folder — it automatically zips and saves to your device
- Select multiple files and folders and download them all as one ZIP
- A progress bar appears at the bottom showing the real percentage and exact file sizes (example: `5.3 MB / 1403 MB — 0%`)
- Cancel the download at any time by pressing the X button
- The bar animates and shows a completion message when done

### 🖼️ Image Viewer
- Tap any image to open the full-screen built-in viewer
- Supports JPG, JPEG, PNG, GIF, WebP, BMP, SVG
- Download button available in the viewer header
- Close button to return to the file browser

### ⬆️ File Upload from Phone to PC
- Tap the Upload button to open the upload zone
- **Browse Files** — pick individual files from your phone gallery or file manager
- **Browse Folder** — upload an entire folder including all subfolders and their structure
- Drag and drop files directly onto the upload zone on desktop
- Real-time upload progress bar showing filename, percentage, speed, and ETA
- Cancel upload at any time
- Notifications show how many files uploaded successfully

### 🎵 Audio Player
- Tap any MP3, FLAC, WAV, AAC, OGG, or M4A file
- Built-in audio player opens with play/pause button and seek bar
- Streams directly — no download needed
- Download button available if you want to save the file

### 🎬 Video Streaming
- Tap any MP4, MKV, MOV, WebM, AVI, M4V, or 3GP file
- Video plays directly in the browser — no download needed
- Full seek support — jump to any point in the video, even on very long videos
- Volume control and fullscreen button
- Works smoothly on WiFi even for large files (1 GB+, 1+ hour videos)
- Use Chrome or Brave for best video streaming experience

### 📄 Document and Text Viewer
- Tap any PDF to open it in the built-in PDF reader
- Tap any TXT, LOG, MD, JSON, JS, PY, HTML, CSS, XML, CSV, INI, BAT, or SH file to read it directly
- Download button available in the viewer

### 🖥️ CMD Dashboard at Startup
- PC hostname and local IP address
- Active drive currently being served
- All detected drives listed with their free space
- The active drive is marked with an asterisk `*`
- Web address clearly shown for both PC and mobile access

---

## 🖥️ System Requirements

**On your PC (server side):**
| | |
|---|---|
| Operating System | Windows 7, 8, 10, or 11 |
| Python | Version 3.7 or higher |
| Network | Connected to a WiFi router |
| RAM | Around 50 MB free |
| Disk space | Less than 1 MB for the app itself |

**On your phone, tablet, or other device (client side):**
| | |
|---|---|
| Installation needed | None |
| Browser needed | Chrome or Brave (recommended) |
| Network | Connected to the same WiFi as the PC |

---

## 📥 Installation — Complete Step by Step Guide

### Step 1 — Install Python on Your PC

Python is the programming language that runs Project Leo. You need to install it once and never again.

1. Open your browser and go to: **https://www.python.org/downloads/**
2. You will see a big yellow button saying **"Download Python 3.x.x"** — click it
3. The download starts — wait for it to finish (about 25 MB)
4. Open the downloaded file to start the installer
5. **⚠️ VERY IMPORTANT — This is the most common mistake people make:**
   On the very first screen of the installer, at the bottom, there is a small checkbox that says **"Add Python to PATH"** — **tick this box before doing anything else**. If you skip this, Python will install but Windows will not be able to find it.
6. After ticking the checkbox, click **"Install Now"**
7. Wait for the installation to complete
8. Click **Close**

**How to check if Python installed correctly:**
1. Press the `Windows` key + `R` on your keyboard at the same time
2. A small "Run" box appears — type `cmd` and press Enter
3. A black CMD window opens
4. Type exactly: `python --version` and press Enter
5. If you see something like `Python 3.12.0` — Python is installed correctly ✅
6. If you see `'python' is not recognized` — go back to Step 1 and make sure you ticked the "Add Python to PATH" checkbox

---

### Step 2 — Download Project Leo

1. Go to the **[Releases](../../releases)** page of this GitHub repository (look for the "Releases" section on the right side of the page)
2. Click on the latest release
3. Under "Assets", click **`Project-Leo.zip`** to download it
4. Wait for the download to finish
5. Find the downloaded ZIP file (usually in your Downloads folder)
6. Right-click on it → click **"Extract All"**
7. Choose where you want to put the folder — the Desktop is a good place
8. Click Extract

After extracting, you should see a folder called `Project-Leo`. Open it and you should see exactly this:

```
Project-Leo/
├── Start-Leo.bat         ← This is what you double-click to start
└── core/
    ├── server.py
    ├── app.js
    ├── app.css
    ├── index.html
    └── login.html
```

If your folder looks like this, you are ready. If something is missing, try downloading again.

---

### Step 3 — Start the Server

1. Open the `Project-Leo` folder
2. Find the file called **`Start-Leo.bat`**
3. **Double-click it**
4. Windows may ask "Do you want to allow this app to make changes?" — click **Yes**
5. A black CMD window opens and you will see: `Starting Project Leo...`

---

### Step 4 — Set Your Username and Password

The CMD window will ask you to set your credentials. This happens every time you start Project Leo — your password is never saved, which makes it more secure.

You will see:

```
  🔐 Security Setup
  Set your login credentials for Project Leo.

  Username: yourname
  Password: ******
  Confirm Password: ******
```

**Setting your username:**
- Type any username you want (minimum 3 characters)
- Example: `admin` or your name
- Press Enter

**Setting your password:**
- Type your password (minimum 6 characters)
- ⚠️ **Important:** When you type the password, nothing appears on the screen. No dots, no stars, nothing. This is completely normal — it is a security feature of the CMD window. Just type your password and press Enter even though you cannot see it.
- If you make a mistake, press Backspace and retype

**Confirming your password:**
- Type the exact same password again
- Press Enter

If both passwords match, you will see:

```
  ✓ Credentials set! Starting server...
```

And then the Project Leo banner appears with your connection details:

```
  ◆  PC Access       http://127.0.0.1:8000
  ◆  Mobile Access   http://192.168.1.4:8000
  ◆  Active Drive    D:
  ◆  All Drives      C: (156 GB free)  *D: (896.8 GB free)  G: (13.3 GB free)
```

**Write down or remember the Mobile Access address** — you will need it on your phone. In this example it is `http://192.168.1.4:8000` but your address will be different.

---

### Step 5 — Connect from Your Phone

1. Make sure your phone is connected to the **same WiFi network** as your PC
2. Open **Chrome** or **Brave** on your phone
3. Tap the address bar at the top
4. Type the Mobile Access address you saw in the CMD window — example: `http://192.168.1.4:8000`
5. Press Go or Enter
6. The Project Leo login page will appear

---

### Step 6 — Log In

1. Enter the username you set in Step 4
2. Enter the password you set in Step 4
3. If you want to stay logged in without typing again during this browser session, check **"Remember me"**
4. Tap **Sign In**

You are now inside Project Leo and can access all your PC files from your phone.

---

## 📖 How to Use — Daily Guide

### Starting every day:
1. Double-click `Start-Leo.bat` on your PC
2. Type your username → press Enter
3. Type your password → press Enter (nothing shows — that is normal)
4. Type your password again → press Enter
5. Open Chrome or Brave on your phone
6. Type the IP address from the CMD window
7. Log in

The whole process takes about 15 seconds.

---

### Stopping the server:
- Go back to the CMD window
- Press `Ctrl + C` on your keyboard
- The server stops immediately
- Your files can no longer be accessed from any device until you start again

---

### Browsing files:
- You start at the Root of your active drive (e.g., D:)
- Tap any folder to open it
- Use the breadcrumb bar at the top to navigate — tap any folder name to jump back to it
- Tap the Up button in the toolbar to go one level up
- Use the Search bar to find files by name in the current folder

---

### Switching to a different drive:
- Look at the breadcrumb bar — you will see a chip showing your current drive (example: `D: ▾`)
- Tap this chip
- A dropdown appears showing all drives on your PC with their free space
- Tap any drive to switch to it instantly

---

### Viewing a file:
- Tap any image, video, audio, PDF, or text file to open the built-in viewer
- For videos — they stream directly without downloading (use Chrome or Brave)
- Tap the X button in the top right to close and go back

---

### Downloading a file or folder:
- **Single file:** Tap the file to open the viewer, then tap the download icon. Or long-press the file and tap Download.
- **Single folder:** Long-press the folder → tap Download → it zips automatically and saves to your phone
- **Multiple items:** Tap the select icon in the toolbar → select everything you want → tap the download icon in the action bar → all selected items download as one ZIP file

---

### Uploading from your phone to the PC:
- Navigate to the folder on your PC where you want to save the files
- Tap the **Upload** button
- Tap **Browse Files** to pick files from your gallery or file manager
- Tap **Browse Folder** to upload an entire folder with all its contents
- The upload progress bar shows you how it is going
- When done, the folder refreshes automatically

---

### Renaming a file or folder:
- Long-press the item → tap **Rename**
- A dialog box appears with the current name
- Clear it and type the new name
- Tap Rename to confirm

---

### Moving a file or folder:
- Long-press the item → tap **Move to**
- A modal appears showing the folder tree
- Navigate to the destination folder
- Tap **Move Here**

---

### Deleting a file or folder:
- Long-press the item → tap **Delete**
- A confirmation dialog appears
- Confirm to delete permanently

---

### Selecting and managing multiple items at once:
- Tap the select mode icon (looks like a list with checkboxes) in the toolbar
- Tap each file or folder you want to select — they get a blue border and checkmark
- Tap **Select All** in the action bar to select everything in the current folder
- Use the action bar buttons to: Download as ZIP / Move / Delete all selected at once
- Tap the X button in the action bar to exit selection mode

---

## 🔒 Security Details

Project Leo is designed to be safe for home and office use on a local network.

- **Local only:** The server only listens on your local network. It is not exposed to the internet. Nobody outside your home or office WiFi can connect.
- **Password required:** Every connection must go through the login page. You cannot access any file without the correct username and password.
- **IP-bound sessions:** After logging in, your session token is tied to your device's IP address. If someone somehow gets your session token, it will not work from a different device or network.
- **No persistent storage of credentials:** Your password is converted to a SHA-256 hash and kept only in RAM while the server is running. The moment you stop the server, the credentials are gone. Nothing is written to disk.
- **Session expiry:** All active sessions expire the moment the server stops. Next time you start, everyone needs to log in again from scratch.
- **Stop when not in use:** When you are done using Project Leo, press Ctrl+C to stop the server. This is the best security practice.

---

## ❓ Frequently Asked Questions

**Q: Does it work without internet?**
Yes. Project Leo works 100% on your local WiFi. Internet is not required at all. Even if your router has no internet connection, Project Leo still works between devices on the same WiFi.

**Q: Can someone outside my home access my files?**
No. The server runs only on your local network (192.168.x.x range). It is not accessible from the internet. Someone would need to be physically connected to your WiFi to reach it.

**Q: Do I need to install anything on my phone?**
No. Just open Chrome or Brave — which are already installed on almost every Android phone — and type the IP address. That is all.

**Q: The IP address changes every time. What do I do?**
Your WiFi router assigns IP addresses automatically (called DHCP). Every time your PC restarts or reconnects, it might get a slightly different IP. The solution is to set a "static IP" or "DHCP reservation" for your PC in your router settings — this keeps your PC at the same IP permanently. If you are not sure how to do this, just check the CMD window each time you start the server — the current IP is always shown there clearly.

**Q: Can multiple people use it at the same time?**
Yes. Multiple devices can connect simultaneously. All of them can browse, download, and even upload at the same time.

**Q: What happens if I close the CMD window by accident?**
The server stops immediately. Files are no longer accessible from any device. To start again, double-click `Start-Leo.bat` and set your credentials again. It only takes about 15 seconds.

**Q: I typed the wrong password. What do I do?**
The server will not start with mismatched passwords. It will say "Passwords do not match. Try again." and let you try again immediately. Just type the password correctly both times.

**Q: Can I change the port number from 8000?**
Yes. Open the file `core/server.py` in Notepad. On the very first few lines, find `PORT = 8000` and change `8000` to any number you want — for example `PORT = 9000`. Save the file. The next time you start, the server runs on the new port and you would type `http://192.168.1.4:9000` instead.

**Q: Can I change which drive it opens by default?**
Yes. Open `core/server.py` in Notepad. Find the line `ROOT_FOLDER = "D:/"` near the top. Change `D:/` to whichever drive you want — for example `C:/` or `E:/`. Save and restart.

**Q: Videos are not playing in Firefox. How do I fix it?**
Switch to Chrome or Brave. Firefox has a known issue with the way Project Leo streams video. It is not easy to fix because Firefox handles HTTP byte-range requests differently. All other features work in Firefox, but for video, Chrome or Brave is required.

**Q: Does it work on iPhone and iPad?**
Yes. Safari works for everything. For video streaming specifically, install Chrome or Brave on your iPhone/iPad for a better experience.

**Q: Is it safe to use on public WiFi?**
No. Do not use Project Leo on public WiFi such as at a cafe, airport, or hotel. Anyone on the same public network could try to access your server. Only use it on your private home or office WiFi where you know and trust all connected devices.

**Q: I see "Connection lost" banner. What happened?**
This means your phone lost contact with the PC server. It could be that you moved out of WiFi range, the PC went to sleep, or the server was stopped. Check that the PC is still running and the CMD window is still open. If the server is still running, try refreshing the page.

---

## 📁 Project Structure Explained

```
Project-Leo/
│
├── Start-Leo.bat
│     This is the file you double-click to start everything.
│     It runs the Python server from the core folder.
│
└── core/
    │
    ├── server.py
    │     The brain of Project Leo. This Python file runs the web server,
    │     handles all file operations, manages login sessions, serves the
    │     frontend files, and handles all API requests.
    │
    ├── app.js
    │     All the browser-side JavaScript. Handles file grid rendering,
    │     navigation, selection, upload/download progress, video thumbnails,
    │     drive switching, and all user interactions.
    │
    ├── app.css
    │     The complete dark theme design. All colors, animations, responsive
    │     layout, progress bars, modals, and UI components are defined here.
    │
    ├── index.html
    │     The main file browser page structure. Contains all the HTML for
    │     the header, toolbar, file grid, modals, and progress bars.
    │
    └── login.html
          The standalone login page. Contains its own CSS and JavaScript
          for the login form, animations, and authentication flow.
```

**That is the entire project — 5 files, no database, no config files, no external dependencies.**

---

## 🛠️ Built With

| Technology | Used For |
|---|---|
| **Python 3** — standard library only | Web server, file reading, ZIP creation, authentication, session management, drive detection |
| **Vanilla JavaScript** | Everything in the browser — file grid, uploads, downloads, video thumbnails, drive switcher, all UI interactions |
| **HTML5 + CSS3** | Page structure and complete dark theme design |
| **Bootstrap Icons** | All icons in the UI — loaded from CDN, no installation needed |
| **Syne font** | Main display font — loaded from Google Fonts |
| **DM Mono font** | Monospace font for addresses, file sizes, badges — loaded from Google Fonts |

**No pip install. No npm. No Node.js. No database. No frameworks.** Project Leo uses only what Python already includes out of the box.

---

## 📄 License

This project is licensed under the **MIT License** — which means you are free to:
- Use it for personal or commercial purposes
- Modify it however you want
- Distribute it to anyone
- Build on top of it

The only requirement is that you keep the original license notice. See the [`LICENSE`](LICENSE) file for the full text.

---

## 🙏 Contributing

Found a bug? Have a feature idea? Want to improve the code?

- Open an **Issue** to report a bug or suggest a feature
- Open a **Pull Request** to contribute code
- **Contact** with [**me**](https://subrcz.xo.je/)

All contributions are welcome.

---

*Made with ❤️ — Subrata Malakar*
