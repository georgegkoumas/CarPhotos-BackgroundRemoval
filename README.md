# MotorMatte

MotorMatte is a privacy-first, installable web app for preparing car-sale photos. It removes the existing background in the browser, lets the user apply a clean neutral or uploaded background, and optionally blurs one or more number plates before downloading a listing-ready JPG.

## What works in this MVP

- JPG, PNG and WebP car-photo upload, including drag and drop
- on-device AI background removal using the quantised IS-Net model
- soft studio, white, graphite or user-uploaded backgrounds
- dependable drag-to-mark number plate blurring with adjustable strength
- before/after preview and full-resolution JPG download
- responsive layout for desktop, tablet and phone
- installable Progressive Web App (PWA)
- no accounts, watermarks, server uploads or per-image API fees

## Privacy and cost model

Image processing happens in the user's browser. The car photo and replacement background are represented by local object URLs and are not sent to the MotorMatte host. On the first background-removal run, the browser downloads the approximately 40 MB quantised AI model from IMG.LY's asset host; subsequent runs use the browser cache.

The application has no database, storage bucket or paid API. It can run on a free static/edge hosting tier. A public deployment can use Cloudflare Workers/Pages Free; this repository is also ready for the private ChatGPT Sites deployment used during development.

## Technology

- Vinext / React / TypeScript
- Tailwind CSS and the bundled accessible UI primitives
- `@imgly/background-removal` with `onnxruntime-web`
- Canvas 2D compositing and privacy redaction
- Web App Manifest and service worker

## Run locally

Requirements: Node.js 22.13 or later and npm.

```powershell
cd "C:\path\to\your\projects"
git clone https://github.com/georgegkoumas/CarPhotos-BackgroundRemoval.git
cd .\CarPhotos-BackgroundRemoval
npm ci
npm run dev
```

Open the local URL displayed in the terminal.

## Build

```powershell
npm run build
```

## Product decisions

The first release uses user-marked number plate regions. This is quicker and more dependable across Australian, European and US plate designs than shipping an unvalidated automatic detector. A later release can add a permissively licensed, browser-compatible number-plate detection model, with manual correction retained as a fallback.

The app is intentionally client-side. This keeps the early service free to operate and gives sellers a strong privacy promise. If future dealer accounts, batch queues shared across devices or saved projects are required, add authentication, object storage and a job service as a separate paid tier.

## Free maintenance plan

1. GitHub hosts the source, issues and dependency update pull requests.
2. GitHub Actions can run `npm ci` and `npm run build` for every change.
3. Cloudflare's free tier hosts the built application; deployments can run from the main branch.
4. Browser-side inference avoids GPU-server and image-storage bills.
5. Review dependency and model licences before introducing any new AI component.

## Licence

MotorMatte is distributed under the GNU Affero General Public License v3.0 because its background-removal dependency uses that licence. See `LICENSE`.
