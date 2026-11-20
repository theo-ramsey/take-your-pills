# My Pills (take-your-pills)

A very simple medicine app for Gloria, with a schedule Bonnie can edit from any browser.

- **Gloria's screen** (`index.html`) shows what's due right now in big print, each with its dose, what it's for and what the pill looks like. She taps **"I'm taking these now"**. She can also add anything else she's about to take.
- **Warnings pop up before she takes anything risky:**
  - a medicine that isn't prescribed
  - a medicine the app doesn't recognise
  - a double dose (already taken today)
  - a prescribed medicine taken at the wrong time
  - too many doses of an as-needed medicine
  - a known interaction with her prescriptions or with something she took earlier that day (for example Advil with Eliquis, NyQuil with Tylenol, or Tums with levothyroxine)
- **Bonnie's page** (`admin.html`) is where Bonnie adds, changes or stops medicines and times. It also shows the last 14 days of history, including missed doses and any warnings Gloria went ahead past. It flags interactions between prescribed medicines so Bonnie can ask the doctor about them.
- **Reminders** arrive as notifications on her iPhone at each dose time, and again 30 minutes later if she hasn't logged it. iPhone notifications also show up on her Apple Watch.

> The interaction list (`js/drugs.js`) is hand-written. It covers common medicines and the most important combinations for older adults, but it is not complete and is not medical advice. Anything the app doesn't recognise tells her to ask the pharmacist.

## Try it now (demo mode)

With `js/config.js` left blank, the app runs in **demo mode** with example medicines, saved only in that browser.

```
npm start          # serves the folder at http://localhost:8080
npm test           # runs the safety-check and reminder tests
```

Open `http://localhost:8080` for Gloria's screen and `http://localhost:8080/admin.html` for Bonnie's page, in the same browser.

## Going live

You need two free accounts: **GitHub Pages** to host the pages and **Supabase** to hold the schedule and send reminders. Setup takes about 30 minutes, once.

### 1. Host the pages on GitHub Pages
On GitHub, open this repository → **Settings → Pages**. Under "Build and deployment", pick **Deploy from a branch**, then branch **main**, folder **/ (root)**, and save. After a minute the site is live at `https://theo-ramsey.github.io/take-your-pills/`.
(For a private repository, GitHub Pages needs a paid plan. Making the repository public is fine: no medical data is stored in it.)

### 2. Create the Supabase project
Sign up at supabase.com and create a new project (free plan). Then open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and click **Run**.
If you want the example medicines too, run `supabase/seed-examples.sql` the same way.

### 3. Turn off public sign-ups
In Supabase, go to **Authentication → Sign In / Providers** and turn off **Allow new users to sign up**. Only accounts you create can sign in.

### 4. Create Bonnie's login
- Go to **Authentication → Users → Add user → Create new user**. Enter Bonnie's email and a password, and tick "Auto confirm".
- In the SQL Editor, run this with her real email (add a line for anyone else who should be able to edit):
  ```sql
  insert into caregivers (email) values ('bonnie@example.com');
  ```

### 5. Connect the pages to Supabase
In Supabase, go to **Project Settings → API** (or **Data API**) and copy the **Project URL** and the **anon public** key into `js/config.js`.

Then make the reminder keys on any computer with Node.js:
```
npx web-push generate-vapid-keys
```
Copy the **public** key into `VAPID_PUBLIC_KEY` in `js/config.js`, then commit and push. Keep the **private** key for step 6.

### 6. Set up the reminder sender
On a computer with Node.js, from this folder:
```
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=pick-a-long-random-password
npx supabase functions deploy send-reminders --no-verify-jwt
```
`YOUR-PROJECT-REF` is the part of the Project URL before `.supabase.co`.

Then open `supabase/cron.sql` and replace `YOUR-PROJECT-REF` and `YOUR-CRON-SECRET` (the same password as `CRON_SECRET`). Run it in the SQL Editor. Reminders are now checked every minute.

### 7. Set up Gloria's iPhone
1. Bonnie opens `…/take-your-pills/admin.html`, signs in, and goes to **Settings**. There she sets Gloria's time zone and her own phone number (for the **Call Bonnie** button on warnings), then clicks **Create setup code**.
2. On Gloria's iPhone, open the setup link from that page in **Safari**.
3. Tap **Share → Add to Home Screen → Add**.
4. Open **My Pills** from the Home Screen. If it asks for a code, type the code shown on Bonnie's page.
5. Tap **Turn on reminders** and then **Allow**. A "Reminders are on" message confirms it works.
6. In the **Watch** app on the iPhone, go to **Notifications** and make sure notifications from the iPhone are mirrored to the watch. Notifications go to the watch when the iPhone is locked.

The iPhone needs iOS 16.4 or newer for web app notifications.

## How it fits together

| File | What it is |
| --- | --- |
| `index.html`, `js/gloria.js` | Gloria's screen |
| `admin.html`, `js/admin.js` | Bonnie's page |
| `js/drugs.js` | Medicine names, brands, combination products and interaction rules |
| `js/checks.js` | The warnings shown before she takes something |
| `js/schedule.js` | What's due, taken, missed |
| `js/store.js` | Saving data (demo: in the browser; live: Supabase) |
| `sw.js`, `manifest.webmanifest` | Makes it installable, shows notifications, works offline |
| `supabase/` | Database setup and the reminder sender |

**Security.** Gloria's phone has no password. It uses a long random setup code, which can only read her schedule, log doses and register for reminders. Bonnie's page needs a Supabase login that is on the `caregivers` list. Making a new setup code disconnects the old phone.

**Offline.** If Gloria's phone has no internet, the app still opens with the last schedule it loaded, and what she logs is sent when the connection comes back.

## Adding to the medicine list
Edit `js/drugs.js`:
- `INGREDIENTS`: generic name, kinds of medicine, and brand names
- `COMBINATIONS`: products with several ingredients, such as cold medicines
- `RULES`: the warnings

Run `npm test` afterwards. When Bonnie adds a medicine, her page shows whether the safety check recognises the name.
