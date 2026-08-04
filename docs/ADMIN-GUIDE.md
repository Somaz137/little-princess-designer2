# Using the admin page

Go to `yoursite.com/admin/` and sign in with your email address and password.
Everything you save becomes live on the website about a minute later.

There are four things in the sidebar:

| | What it's for |
|---|---|
| **Products** | Every piece in the shop |
| **Subcategories** | The sections inside each tab — "Casual dresses", "Rompers" |
| **Category pages** | The wording at the top of Girls / Boys / Babies / Ready to wear |
| **Site settings** | Phone number, email, social links, and the wording on the home and contact pages |

---

## Add a product

**Products → New Product.**

Only four things are required:

1. **Product name** — what customers see, e.g. "Aurora Luxury Gown"
2. **Subcategory** — pick from the dropdown
3. **Sizes and prices** — one row per age band you make it in
4. **Photos** — at least one

Everything else has a sensible default. Press **Publish** when done.

### Sizes and prices

Each row is one age band and its price:

```
0–3 years      18500
4–6 years      19400
7–9 years      20300
```

The price on the website changes when the customer picks a size. Type numbers
only — `18500`, not `18,500` or `PKR 18500`.

- To **stop offering a size**, either untick **Available** or delete the row.
- To **change a price**, just type over it and publish.
- A product needs **at least one** size with a price, or it will not appear on
  the site.

### Photos

Each photo row gives you two ways to add an image — use whichever suits:

- **Upload a photo** — drag a file in from your computer or phone
- **…or paste an image link** — a full `https://…` address

If you fill in both, the pasted link wins.

The **first photo** is the one shown on the card in the shop. The product page
shows up to three, so front / side / back works well.

Please add a **photo description** for each one. It is what appears if the image
fails to load, what screen readers read out, and what Google uses to understand
the picture. "Blush pink net party frock, hand-beaded bodice" is much better
than "dress1".

> **Keep photos small.** Around 1600px wide and under 300 KB. A photo straight
> off a phone is often 4–8 MB, which makes the site slow on mobile data.

### Descriptions

Leave **Description** blank and the product uses its subcategory's standard
description. That is usually what you want — write it once on the subcategory
instead of retyping it for every dress.

Fill it in when a particular piece deserves its own words: an unusual fabric, a
specific colour, special handwork.

The same applies to **Details** (fabric, occasion, fit, care). Blank fields fall
back to the subcategory.

---

## Hide a product without deleting it

Open the product and turn **Show on website** off, then publish.

It disappears from the shop immediately, and everything you typed stays exactly
where it is. Turn it back on whenever you like.

Use this for pieces that are out of season, sold out for good, or not
photographed yet. **Delete** is for mistakes — it is permanent.

If you want a piece to stay visible but marked as unavailable, leave it on and
set **Badge** to "Sold out" instead.

---

## Change a price

**Products** → click the product → change the number in the **Sizes and prices**
list → **Publish**.

To change several products' prices, do them one at a time; each publish is
separate.

---

## Add or remove a subcategory

**Subcategories → New Subcategory.**

- **Short code** — a permanent code like `g5`. Products remember this code, so
  **do not change it later** — if you need a different code, make a new
  subcategory and move the products across.
- **Name** — the heading shown on the page, e.g. "Party skirts". Safe to rename
  whenever you like.
- **Tab** — which of the four shop tabs it belongs to.
- **Sort order** — lower numbers appear higher up the page.
- **Standard description / details** — used by every product in this section
  that doesn't have its own.

**To remove one:** delete it — but move its products to another subcategory
first. A product whose subcategory no longer exists disappears from the website
until you reassign it. Nothing is lost, but it is invisible in the meantime.

---

## Change your phone number, email or social links

**Site settings → Contact details.**

The WhatsApp number is used by every WhatsApp button on the site — the floating
button, the product pages, the contact page. Changing it here changes all of
them.

Enter it as digits only, with the country code and no `+` or spaces:
`923217152723`.

---

## Change the wording on the home or contact page

Also **Site settings**. The sections are in the order they appear on the site:

- **Hero headlines** — the three hand-lettered lines that fade in over the dress
- **Hero buttons** — the three cards under it
- **Features** — the four berry cards
- **Banner** — the pink strip. Wrap words in `**double asterisks**` to bold them
- **About us** — leave a blank line between paragraphs
- **Carousel photos** — the spinning ring of pieces
- **Contact page** — ordering steps, FAQs, social card wording, feedback block

FAQs are also published in a format Google understands, so they can appear
directly in search results. Worth keeping them accurate.

---

## Common questions

**I published something and the site hasn't changed.**
Give it a minute or two — the site rebuilds after each change. If it still
hasn't, check Netlify's **Deploys** tab for a failed build.

**My product isn't showing up.**
Check: **Show on website** is on, it has at least one size with a price, and its
subcategory still exists.

**I made a mistake — can I undo it?**
Yes. Every change is saved in the repository's history on GitHub, so nothing is
ever truly lost. Ask whoever set the site up to roll it back. Each entry in that
history carries the name of whoever made the change.

**Can I let someone else add products?**
Yes — invite them by email from the DecapBridge dashboard. They do not need a
GitHub account, and they can only reach this admin form, nothing else.

**Can two people edit at once?**
Yes, but avoid both editing the *same* product simultaneously — the second save
may complain about a conflict. Different products are completely fine.
