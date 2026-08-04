# Setting up the admin page

You need to do this once. After that, adding a product is just opening
`yoursite.com/admin/` and filling in a form.

There are three steps: push the code to GitHub, connect Netlify, and set up
sign-in with DecapBridge.

Sign-in goes through [DecapBridge](https://decapbridge.com), which means you log
in with an email address and password. You do **not** need a GitHub account to
edit the site, and neither does anyone you invite later.

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

## 3. Set up sign-in (DecapBridge)

The admin saves changes by committing to your GitHub repo, so something has to
be allowed to do that on your behalf. DecapBridge handles it, and lets you sign
in with an ordinary email address.

**This step is already done** — the site exists on DecapBridge and its details
are in `site/admin/config.yml`. What follows is for reference, in case the
DecapBridge site is ever deleted and recreated.

### How it was set up

1. Sign up at [decapbridge.com](https://decapbridge.com).
2. Create a **Site** and connect it to this GitHub repository when asked.
3. DecapBridge produces a ready-made `backend:` block. Paste it over the one in
   `site/admin/config.yml`, keeping everything from `local_backend:` downwards
   — that part is this site's own configuration and DecapBridge knows nothing
   about it.

The site's id appears **twice**, in `auth_endpoint` and `auth_token_endpoint`.
If you ever replace it, replace both.

Two blocks in the config are optional but worth keeping:

- **`auth:`** tells the admin where to find the editor's name in their
  DecapBridge login. Without it, the names in the commit messages come out blank.
- **`commit_messages:`** puts that name into the repository history.

---

## 4. Log in

Go to `https://littleprincessdesigner.netlify.app/admin/` and press **Login**.
You are sent to DecapBridge to sign in — by email and password, or with Google
or Microsoft — and then returned to the admin. You should land on **Products**,
with **Subcategories**, **Category pages** and **Site settings** in the sidebar.

That's it. Every change you save becomes a commit, Netlify rebuilds, and the
website updates in a minute or two.

---

## 5. Optional: let someone else edit

In your DecapBridge dashboard, open your site → **Manage collaborators** →
invite by email. They set their own password (or sign in with Google or
Microsoft) and can use the admin straight away.

They never need a GitHub account, and they get no access to the repository
itself — only to the admin form. Because everyone's edits are committed by
DecapBridge rather than by their own account, `config.yml` puts the editor's
name into each commit message so you can still tell who changed what.

For that to be worth anything, each person has to fill in their **name** when
they accept the invitation. If they leave it blank the commit message simply
ends with a dash and nothing after it — harmless, but useless for telling who
did what.

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
Something in the `backend:` block of `config.yml` is wrong. Check it against
your DecapBridge dashboard, and open your browser's developer console for the
actual error.

**Pressing Login goes to DecapBridge and comes back with an error**
Either the site id in `auth_endpoint` / `auth_token_endpoint` is wrong — it
points the login at a site that isn't yours — or the email you are using has not
been invited to this site on DecapBridge.

**Logged in, but the commit history shows a blank name**
Either the `auth:` block is missing from `config.yml`, or that person did not
fill in their name on DecapBridge.

**Login works, but saving fails**
DecapBridge has lost its connection to the GitHub repository. Re-connect the
repo from the DecapBridge dashboard. This can also happen if the repository is
renamed — `repo:` in `config.yml` has to match.

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
