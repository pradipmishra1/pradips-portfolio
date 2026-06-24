# Pradip Mishra — Portfolio + Admin Panel

A full-stack rebuild of the portfolio site: a fast public site, a real
admin panel for managing content, and an AI assistant with the API key
kept safely on the server.

## What changed from the old version

- **Security fix**: the Groq API key used to be hardcoded in the browser
  HTML/JS — anyone could view source and steal it. It now lives only in
  `.env` on the server and is never sent to the browser.
- **Real admin panel**: add/edit/delete portfolio projects, services,
  pricing plans; approve reviews; read contact messages; edit site text —
  all stored in a real database, visible to every visitor (not just you).
- **Fixed broken/junk files**: removed the leftover `project8_files/current1-10.jpg`
  browser-cache clutter and the mismatched `service1-4.jpg` reference.
- **Faster images**: uploaded photos are automatically resized and
  compressed (WebP) by the server, which directly fixes the "laggy" feeling
  caused by serving full-size phone photos.
- **Redesign**: a print-studio/contact-sheet visual style — paper, ink,
  halftone dot textures, tape-corner project cards — instead of the
  generic dark-mode-with-orange-accent template look.
- **One AI assistant** instead of two competing widgets fighting over the
  same API quota.
- **Real review storage**: reviews submitted by visitors are now stored on
  the server (with an approval step) instead of only in the visitor's own
  browser (localStorage), which meant nobody else could ever see them.

## Project structure

    pradip-portfolio/
    ├── server/              Node/Express backend
    │   ├── index.js         entry point, route wiring, security middleware
    │   ├── db.js            SQLite schema + seed data
    │   ├── auth.js          admin login, password hashing, JWT sessions
    │   ├── groq.js          the ONLY file that touches the Groq API key
    │   ├── upload.js        image upload + compression (multer + sharp)
    │   ├── routes-public.js GET endpoints + contact/review forms (no login)
    │   ├── routes-admin.js  full CRUD, requires admin login
    │   └── routes-ai.js     AI features, proxied through the server
    ├── public/              everything served to visitors
    │   ├── index.html       the main site
    │   ├── css/main.css
    │   ├── js/main.js        fetches data from /api/* and renders it
    │   ├── js/assistant.js   floating AI chat widget
    │   └── admin/            the admin panel (login-protected)
    ├── uploads/              uploaded project photos (compressed automatically)
    ├── data.db               SQLite database (created automatically on first run)
    ├── .env                  your real secrets (NEVER commit this)
    └── .env.example          template showing what's needed

## First-time setup

1. Install dependencies (you confirmed Node.js is already installed):

       cd pradip-portfolio
       npm install

2. Create your `.env` file by copying the example:

       cp .env.example .env

   Then open `.env` and fill in:
   - `GROQ_API_KEY` — get a brand-new key. Go to your Groq console,
     revoke/delete the old exposed key (`gsk_FTGod3...`), and generate a
     fresh one. Paste the new one here.
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — whatever you want to log into
     `/admin` with. Change this from any password you've shared anywhere.
   - `JWT_SECRET` — a long random string. Generate one with:

         node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

3. Run the server:

       npm start

   You should see:

       🚀 Pradip Mishra Portfolio running at http://localhost:3000
       🔐 Admin panel at http://localhost:3000/admin

4. Open the site at `http://localhost:3000`.
   Open the admin panel at `http://localhost:3000/admin` and log in with
   the username/password you set in `.env`.

5. Add your real content through the admin panel:
   - **Portfolio Work** — add each project with a real screenshot. Images
     are automatically compressed, so upload your best-quality source file
     without worrying about file size (up to 12MB raw).
   - **Services**, **Pricing**, and **Site Settings** can all be edited the
     same way — no code changes needed for routine updates.
   - Put your real profile photo at `public/images/mphoto.jpg` for the
     About section (or update the path in `index.html` if you'd rather
     manage it elsewhere).

## Important: rotate your old API key

Your previous Groq key was visible to anyone who viewed the page source on
the live site. Even though the new code never exposes it, the old key
itself is still compromised because it was public for a while. Go to your
Groq dashboard and revoke the old key specifically
GROQ_API_KEY=your_groq_api_key_here, then generate
the new key mentioned in step 2 above.

## Deploying (once you pick a host)

This is a standard Node.js app, so it runs the same way on most hosts:

- **Render / Railway**: connect your GitHub repo, set the same environment
  variables from `.env` in their dashboard (never upload `.env` itself),
  set the start command to `npm start`.
- **A VPS** (DigitalOcean, etc.): clone the repo, run
  `npm install --production`, set up `.env`, run with a process manager
  like `pm2` so it restarts automatically (`pm2 start server/index.js`).
- Set `NODE_ENV=production` in your host's environment variables — this
  enables secure cookies for the admin login.
- The SQLite database (`data.db`) and `uploads/` folder need to live on
  persistent storage. Most VPS setups are fine by default. Some
  serverless/container platforms wipe the filesystem on redeploy — if your
  host does this, let me know and we can switch the database to Postgres
  instead, which is a small, contained change.

## Day-to-day use

- Add a new project: Admin → Portfolio Work → Add Project.
- A new review came in: Admin → Reviews → Pending → Approve or Delete.
- Check who messaged you: Admin → Messages.
- Update your bio, stats, or socials: Admin → Site Settings.

No code edits needed for any of the above — that was the whole point of
the admin panel.
