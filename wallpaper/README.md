# Packaged wallpaper

One file lives here: **`default.webp`**.

It is the wallpaper a brand-new install starts on. `applyPackagedWallpaper()`
in `js/ui/settings-core.js` looks for exactly this path on the first run of a
fresh profile, and silently falls back to the solid background if it is not
there — so shipping without it is safe, it just means new users start on a flat
colour.

## Replacing it

```bash
python dev/make-wallpaper.py path/to/your-photo.jpg
```

That converts, flattens, caps the long edge at 2560px and writes
`wallpaper/default.webp`. Requires `pip install Pillow`.

## Why WebP, and why only one

Every wallpaper a user uploads is converted to WebP at 2560px by
`downscaleImage()` before it is stored. A packaged PNG or JPEG would make the
wallpaper new users see the only one in the product that is not — heavier to
ship and heavier to paint, on the page that is painted more often than any
other.

It is referenced by path rather than copied into `chrome.storage.local`: the
file is already on disk at the extension's own origin, so storing a base64 copy
would spend quota duplicating it, and the path keeps working across updates
with no migration.

## Applying, not overriding

The wallpaper is applied **once**, and only when the profile is still on a
solid background. A user who picks their own — or goes back to a colour — is
never handed this one again, and an install that arrives with a wallpaper
already configured (a restored backup, a synced profile) keeps what it came
with.
