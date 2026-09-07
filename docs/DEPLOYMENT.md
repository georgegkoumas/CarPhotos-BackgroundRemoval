# Free public deployment

Cloudflare Workers is the recommended public host for MotorMatte. The Free plan currently includes 100,000 Worker requests per day, while requests served as static assets are free and unlimited. Because all image processing runs in the user's browser, a normal MotorMatte session does not spend server CPU on the photo.

## Git-connected deployment

1. Create the GitHub repository `georgegkoumas/CarPhotos-BackgroundRemoval` and push this source to its `main` branch.
2. In Cloudflare, open **Workers & Pages**, choose **Create application**, then **Import a repository**.
3. Select `CarPhotos-BackgroundRemoval`.
4. Use Node.js 22 and the build command `npm run build`.
5. Deploy and test the generated `workers.dev` address.
6. Add a custom domain only when one is available; it is not required for the free MVP.

Cloudflare's Git integration rebuilds the application when `main` changes. The repository's Build workflow separately prevents a broken change from being merged unnoticed.

## Important operating notes

- Keep the repository public while using the AGPL-licensed background-removal library, and retain the licence and source notices.
- Do not add uploaded-image analytics or server logs: the product promise is that photos stay on the user's device.
- The AI model is fetched from IMG.LY on first use. Self-hosting the model assets can be considered later if the product needs stronger supply-chain control.
- Set a monthly Cloudflare spending limit of zero and stay on the Workers Free plan for the MVP.
