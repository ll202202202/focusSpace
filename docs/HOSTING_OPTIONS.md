# Public Hosting Options (Static Vite / React Project)

> Research date: 2026-07-31. This document cites only official platform or product documentation and official pricing pages.

## Bottom line

Focus Space is currently a pure front-end static site: `npm run build` produces the `dist/` directory, which is all that needs to be published. The Pomodoro timer's settings and history are stored in the browser's IndexedDB, so **the current version does not need a backend server, database, long-running Node.js process, or VPS**.

For personal use or overseas/global access, start with the free tiers of Cloudflare Pages, Vercel, or Netlify; GitHub Pages is an option when you want to host the code and site together. If the service is primarily for users in mainland China and you want domestic-cloud performance and support, use Tencent Cloud COS or Alibaba Cloud OSS static website hosting, and prepare a domain name and ICP filing.

## What you need before deployment

1. Node.js (needed only for local or CI builds): run `npm install` and `npm run build` in the project root.
2. Build output: the official Vite guide specifies `dist` as the static deployment output (as does this project). [Vite: Static Site Deployment](https://vite.dev/guide/static-deploy.html)
3. An account on a hosting platform; if using a custom domain, also buy the domain and configure DNS.
4. HTTPS: the mainstream static platforms below can provide HTTPS for their platform domains. When binding a custom domain, complete the DNS verification/records required by the platform and wait for certificate issuance.
5. No database or application server is required. An API + database will only be needed if cross-device synchronization, sign-in, or team statistics are added later (for example, Supabase, Cloudflare Workers/D1, or a domestic cloud service).

## Platform comparison

| Option | Cost and fit | Vite static deployment | Custom domain / HTTPS | Best for and considerations |
| --- | --- | --- | --- | --- |
| **Cloudflare Pages** | The official product page offers a Free plan, suitable for personal static sites; see the current pricing page for exact limits. | Configure the build command and build output directory; Vite outputs to `dist`. | Supports apex-domain and subdomain binding; configure DNS according to the Pages domain documentation. | Global CDN and no operations burden; one of the top choices for personal projects. Mainland-China access depends on network conditions. |
| **Vercel** | Has a Hobby (free) plan; its official pricing page states it is for personal/non-commercial use, and commercial use should use Pro. | The official Vite guide supports importing from a Git repository or deploying with the CLI. | Project domains can be added; the platform configures HTTPS for them. | Excellent Git-push auto-deployment experience; pay close attention to free-tier use restrictions. |
| **Netlify** | The official pricing page offers a Free plan; see the page for current bandwidth and build allowances. | Build command: `npm run build`; publish directory: `dist`. | The official Domains docs support custom domains; Netlify manages HTTPS. | Straightforward to operate and supports Git auto-deployment; check free quotas and commercial-use terms. |
| **GitHub Pages** | GitHub Free can use Pages for public repositories; private-repository and organization availability depends on GitHub's current plans and repository visibility. | Use GitHub Actions to build Vite and publish `dist`, or publish from a branch/directory. | Supports custom domains and enabling HTTPS for them. | The cheapest option, with code and site together; static sites only, without server-side APIs. |
| **Tencent Cloud COS static website hosting** | Charged for COS storage, requests, outbound traffic, and possibly CDN/domain use; it is not typically “free forever.” | Upload the files in `dist`, configure the default home page/error page, and optionally integrate CDN. | Configure domain, certificate, and CDN through Tencent Cloud products. | Better suited to mainland China; Chinese-mainland resources generally require ICP filing before use. |
| **Alibaba Cloud OSS static website hosting** | Charged for OSS storage, requests, traffic, and possibly CDN/domain use; it is not typically “free forever.” | Upload the files in `dist`, enable static website hosting in the Bucket, and set the home page/error page. | Configure domain, certificate, and CDN through Alibaba Cloud products. | Better suited to mainland China; Chinese-mainland resources generally require ICP filing before use. |
| **Low-cost VPS (Tencent Cloud Lighthouse/ECS, Alibaba Cloud ECS)** | New-user and annual-payment offers are common, but prices and inventory vary; use current official purchase pages. | Host `dist` with Nginx/Caddy; you must maintain the OS, certificates, updates, monitoring, and security. | Buy a domain and configure HTTPS with Let's Encrypt or a cloud certificate. | Unnecessary for this project; choose it only if you later need a self-hosted API, WebSocket, scheduled jobs, or special reverse proxy. |

## Official sources

- [Vite: Static Site Deployment](https://vite.dev/guide/static-deploy.html): static deployment workflow and the `dist` output.
- [Cloudflare Pages: Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/); [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/); [Pages product/pricing entry point](https://www.cloudflare.com/developer-platform/products/pages/).
- [Vercel: Deploying Vite](https://vercel.com/docs/frameworks/frontend/vite); [adding domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain); [official pricing](https://vercel.com/pricing).
- [Netlify: Official pricing](https://www.netlify.com/pricing/); [build configuration](https://docs.netlify.com/build/configure-builds/overview/); [domain quick start](https://docs.netlify.com/manage/domains/get-started-with-domains/); [free HTTPS](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/).
- [GitHub Pages: Choosing a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site); [managing custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site); [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https); [pricing](https://github.com/pricing).
- [Tencent Cloud COS: Static website hosting](https://www.tencentcloud.com/document/product/436/14984); [Tencent Cloud: ICP filing guidance](https://cloud.tencent.com/document/product/243/18905).
- [Alibaba Cloud OSS: Static website hosting](https://www.alibabacloud.com/help/en/oss/user-guide/static-website-hosting); [Alibaba Cloud: ICP Filing overview](https://www.alibabacloud.com/help/en/icp-filing/latest/overview).

## Mainland China: ICP filing and domain reminders

- When a site is actually connected to a **mainland China** server, object-storage static site, or CDN, ICP filing generally must be completed first. Cloud providers require the filing information to match the connected resource and domain registrant. Follow the current filing process of your chosen provider and local regulatory requirements.
- Using overseas platforms such as Cloudflare Pages, Vercel, Netlify, or GitHub Pages normally does not require the mainland-cloud provider filing process, but that neither guarantees mainland access quality nor eliminates all compliance obligations. If operating publicly for mainland users, still assess business content, personal-information processing, domain real-name verification, and applicable regulations.
- A domain name is a separate cost. Registrars, TLDs, and renewal prices vary considerably; see registrar pages for current `.com`, `.cn`, and other prices. Domains such as `.cn` also often require real-name review.

## Recommended path for this project

**Lowest effort (recommended first):** GitHub repository + Cloudflare Pages. Connect the repository, set Build command to `npm run build` and Build output directory to `dist`, and each push will publish automatically. Start with the free `*.pages.dev` subdomain, then purchase and bind a domain once the site is stable.

**Primarily for mainland-China users:** Alibaba Cloud OSS or Tencent Cloud COS + CDN + an ICP-filed domain. You still upload only `dist` and do not need a VPS; costs generally consist of the domain, a small amount of object storage/traffic, and optional CDN.

**Personal demo only:** GitHub Pages is sufficient. Note that SPA routing (if React Router is added later) needs extra 404 fallback handling. This project is currently a single-page timer, so this is not an issue.
