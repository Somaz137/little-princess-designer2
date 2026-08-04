# Setting up the admin page

You need to do this once. After that, adding a product is just opening
`yoursite.com/admin/` and filling in a form.

There are four steps: push the code to GitHub, connect Netlify, let the admin
log in via GitHub, and tell the admin which repo it belongs to.

---

## 1. Push the code to GitHub

Create a new **private** repository on GitHub (private is fine — Netlify can
still build it), then from this folder:

```bash
git add .
git commit -m "Little Princess Designer site + admin"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Write down `YOUR-USERNAME/YOUR-REPO` — you need it twice below.

---

## 2. Connect Netlify

1. Log in to [netlify.com](https://netlify.com) → **Add new site** → **Import an
   existing project** → **GitHub** → pick your repository.
2. Netlify reads `netlify.toml`, so the build settings should already be filled
   in. Confirm they say:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Click **Deploy**.

The first deploy takes a minute or two. You will get a URL like
`https://something-random-123.netlify.app`. You can change it under
**Site configuration → Site details → Change site name**, or point your own
domain at it later.

At this point the *website* works. The admin page will load but not let you in
yet — that is step 3.

---

## 3. Let the admin log in (GitHub OAuth)

The admin saves changes by committing to your GitHub repo, so it needs your
permission to do that. This is a one-time handshake.

### 3a. Create a GitHub OAuth app

1. GitHub → click your avatar → **Settings**
2. Bottom of the left sidebar → **Developer settings**
3. **OAuth Apps** → **New OAuth App**
4. Fill in:
   - **Application name:** `Little Princess Admin`
   - **Homepage URL:** your Netlify URL, e.g. `https://littleprincess.netlify.app`
   - **Authorization callback URL:** `https://api.netlify.com/auth/done`
     — this exact address, not your own site
5. **Register application**
6. Copy the **Client ID**, then **Generate a new client secret** and copy that too.
   The secret is only shown once.

### 3b. Give them to Netlify

1. Netlify → your site → **Site configuration** → **Access & security** →
   **OAuth**
2. Under **Authentication providers** → **Install provider** → **GitHub**
3. Paste the Client ID and Client Secret → **Install**

---

## 4. Tell the admin which repo to edit

Open `site/admin/config.yml` and change the third line:

```yaml
backend:
  name: github
  repo: OWNER/REPO          # <-- change this
```

to your actual repository, for example:

```yaml
  repo: rimazasif/little-princess
```

Commit and push. Netlify redeploys.

---

## 5. Log in

Go to `https://your-site.netlify.app/admin/` and click **Login with GitHub**.
You should land in the admin with **Products**, **Subcategories**,
**Category pages** and **Site settings** in the sidebar.

That's it. Every change you save becomes a commit, Netlify rebuilds, and the
website updates in a minute or two.

---

## Optional: Cloudinary for photos

By default, photos you upload are committed into the repository. That is fine
for a few hundred web-sized images, but anything committed to git stays in its
history forever — so a hundred 6 MB photos will make the repo slow to clone and
count against your storage permanently.

If you would rather keep photos out of the repo:

1. Sign up at [cloudinary.com](https://cloudinary.com) (the free tier is
   generous) and find your **Cloud name** and **API key** on the dashboard.
2. In `site/admin/config.yml`, uncomment the `media_library` block and fill in
   both values.
3. Commit and push.

Uploads then go to Cloudinary instead, and the config already asks Cloudinary to
resize to 1600px and auto-pick the best format, so photos load fast without you
having to think about it.

The three hero images (`dress-sketch-tall.webp`, `dress-colour-tall.webp`,
`dress-real-tall.webp`) stay as files in `site/assets/` either way. They are part
of the page design rather than catalogue content, so they are not editable in
the admin — replace the files directly if you ever want to change them.

**Either way**, keep uploads reasonably sized: about 1600px on the long edge and
under 300 KB. Phone photos straight from the camera are typically 4–8 MB, which
makes the site slow to load on mobile data.

---

## A note on the two ways to add a photo

Each photo row in the admin has an **Upload a photo** field and an **…or paste
an image link** field. Separately, Decap's own image picker also has an
**Insert from URL** button inside it.

Both routes work, and the site treats them the same way. Use whichever you
prefer — the `url` field is just more visible, since you can see the address on
the form without opening a dialog. If a row has both an upload and a pasted
link, the link wins.

---

## Working on it locally

You do not need any of the above to try the admin on your own machine:

```bash
npm run build      # generate dist/
npm start          # serve it at http://localhost:8080
```

In a **second terminal**:

```bash
npm run cms        # local save server, so the admin can write files
```

Then open <http://localhost:8080/admin/>. Because `local_backend: true` is set,
the admin skips the GitHub login and writes straight to your `content/` folder.
Run `npm run build` again to see the changes on the site.

---

## If something goes wrong

**The admin is stuck on "Opening the admin…"**
The repo name in `config.yml` is probably wrong, or the OAuth provider is not
installed. Check both, and open your browser's developer console for the actual
error.

**"Login with GitHub" does nothing, or fails**
The callback URL on the GitHub OAuth app must be exactly
`https://api.netlify.com/auth/done`. A common mistake is putting your own site
there.

**I saved a change but the website looks the same**
Netlify needs a minute to rebuild. Check **Deploys** in Netlify — if the build
failed, the log will say why. The most likely cause is a content problem, and
the build prints exactly which product is at fault.

**A product is not showing up**
Check three things in the admin: **Show on website** is on, it has at least one
size with a price, and its subcategory still exists.

**I deleted a subcategory and its products vanished**
That is expected — they have nowhere to live. Open each product and pick a new
subcategory. Nothing was lost. The build log lists every affected product by
name.

**The build failed with "exists in the JSON but is NOT declared in config.yml"**
Someone hand-edited a file in `content/` and added a field the admin does not
know about. Either add that field to `config.yml` or remove it from the JSON.
This check exists because the admin silently deletes undeclared fields when you
press Save — the build stops first so nothing is lost.
