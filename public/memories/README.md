# Memory media

Drop photos and videos here. The filename's stem must match a memory `id` from
`src/components/MemoryUniverse.tsx` (e.g. `m1`, `m2`, ... `m16`).

## Photos

```
public/memories/m1.jpg
public/memories/m1.png
public/memories/m1.webp
```

Any of `.jpg`, `.png`, `.webp` works. WebP is smallest. The component picks
whichever you actually drop in via the explicit filename you set on the
memory's `media` field.

Aim for 1200px on the long edge, ~150–400 KB each. Phones load fast that way.

## Videos

```
public/memories/m4.mp4
public/memories/m4-thumb.jpg   (optional poster frame)
```

Use `.mp4` (H.264). Keep clips short — 5–10 seconds is plenty. The poster
shows before the user taps play.

To make a poster from a video on macOS:

```sh
# Generate a poster from the first second of the clip
swift -e 'import AVFoundation; import AppKit
  let url = URL(fileURLWithPath: CommandLine.arguments[1])
  let asset = AVURLAsset(url: url)
  let gen = AVAssetImageGenerator(asset: asset)
  gen.appliesPreferredTrackTransform = true
  if let cg = try? gen.copyCGImage(at: CMTime(seconds: 0.5, preferredTimescale: 600), actualTime: nil),
     let data = NSBitmapImageRep(cgImage: cg).representation(using: .jpeg, properties: [:]) {
    try? data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
  }' input.mp4 output.jpg
```

## Referencing files in code

In `MemoryUniverse.tsx`, each memory has an optional `media` field:

```ts
{ id: "m1", x: 380, y: 280, title: "First snow", caption: "...",
  tone: "sky",
  media: { type: "image", src: "/memories/m1.jpg" } }
```

```ts
{ id: "m4", x: 1280, y: 620, title: "Mossgate", caption: "...",
  tone: "moss",
  media: { type: "video", src: "/memories/m4.mp4", poster: "/memories/m4-thumb.jpg" } }
```

Paths start with `/` — Vite serves the `public/` folder at the site root, so
`/memories/m1.jpg` is the URL.

## Compressing on the command line

```sh
# Photo: resize + compress to ~1200px wide JPEG
sips -Z 1200 -s formatOptions 80 input.jpg --out output.jpg

# Photo: convert to WebP (smaller, modern browsers)
cwebp -q 80 input.jpg -o output.webp

# Video: re-encode to web-friendly H.264 (needs ffmpeg)
ffmpeg -i input.mov -vcodec libx264 -crf 23 -preset slow \
  -vf "scale='min(1280,iw)':-2" -an output.mp4
```
