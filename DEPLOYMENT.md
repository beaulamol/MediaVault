# Deployment

This project uses one GitHub repository with two services:

- Render Free Web Service: runs the existing Node API.
- Vercel Hobby: builds and hosts the Vite frontend.

The frontend calls relative `/api/...` URLs. `vercel.json` forwards those requests to `https://mediavault-8ue6.onrender.com/api/...`, so the browser does not call localhost or the Render domain directly.

## Commit These Files

Commit these repository files:

- `vercel.json`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- The existing source and server files

Do not commit `.env` files or other secrets. The current `.gitignore` excludes environment files, dependencies, build output, and TypeScript build metadata.

## Render API

Create a new **Web Service** in the Render dashboard.

1. Connect the GitHub repository containing this project.
2. Set **Root Directory** to the repository root, `/`.
3. Use the Node runtime.
4. Set **Build Command** to `npm install`.
5. Set **Start Command** to `node server/index.mjs`.
6. Select the **Free** instance type.
7. Set the health check path to `/api/health`.
8. Add these environment variables:
   - `CHAOS=1`
   - `LATENCY=1`

The server already reads Render's assigned `PORT` environment variable, falling back to `8787` for local development. No change to `server/` is required. After deployment, verify:

```text
https://mediavault.onrender.com/api/health
```

The response should report `ok: true`. Keep the Render service URL exactly as `https://mediavault-8ue6.onrender.com`, or update the destination in `vercel.json` if Render assigns a different URL.

## Vercel Frontend

Create a new Vercel project from the same GitHub repository.

1. Import the repository.
2. Set **Root Directory** to the repository root, `/`.
3. Select the Vite framework preset.
4. Set **Build Command** to `npm run build`.
5. Set **Output Directory** to `dist`.
6. Leave the install command as the default, or use `npm install`.
7. Deploy.

The committed `vercel.json` contains the API rewrite. No frontend API environment variable is needed because the client uses relative paths such as `/api/assets` and `/api/thumb/:id.svg`.

There are no client-side routes in this application, so an SPA fallback rewrite is not needed. The API rewrite is kept separate and does not intercept built assets.

## Changing the API URL

If the Render URL changes, update the `destination` in the committed `vercel.json`:

```json
{
  "source": "/api/:path*",
  "destination": "https://YOUR-RENDER-SERVICE.onrender.com/api/:path*"
}
```

Commit and push that change, then trigger a new Vercel deployment from the dashboard or wait for the repository integration to deploy it automatically.

## Local Development

Local development is unchanged:

```bash
npm install
npm run dev
```

Vite keeps using its local proxy from `/api` to `http://localhost:8787`. The production Vercel rewrite is only used after deployment.

## Final Checks

Before sharing the Vercel URL:

1. Confirm Render `/api/health` returns successfully.
2. Open the Vercel URL and confirm the asset list loads.
3. Search and load a thumbnail; requests should stay under the Vercel `/api` path.
4. Test a bulk update with chaos enabled.
5. Run `npm run typecheck` and `npm run build` from the repository root.
