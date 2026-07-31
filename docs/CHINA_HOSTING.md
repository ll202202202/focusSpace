# Deployment Options Accessible from Mainland China

Focus Space is a pure static React application built with Vite. Its build output is `dist/`, and it needs no Node server, database, or API. Application settings and records are stored in each visitor's browser IndexedDB. You can therefore use domestic static hosting without purchasing a cloud server.

## Recommended order

1. **Tencent Cloud CloudBase static website hosting**: the lowest operational overhead for a first deployment and suitable for a small personal tool. It supports console uploads/CLI deployment and provides a platform domain; bind a custom domain later if needed.
2. **Tencent Cloud COS + CDN**: suitable when you want full control over the bucket, domain, and traffic acceleration. You must upload `dist/` and configure the static website manually.
3. **Alibaba Cloud OSS + CDN**: the same architecture as COS + CDN; suitable if you already have an Alibaba Cloud account, domain, or CDN resources.

> Bottom line: for direct access from ordinary mainland-China networks, use Tencent Cloud or Alibaba Cloud resources located in mainland China and a custom domain with completed ICP filing. International-platform domains (such as Vercel's `vercel.app`) are not reliably reachable from mainland-China networks.

## Option 1: Tencent Cloud CloudBase static website hosting (try first)

**Fit**: well suited to this project. Run `npm run build`, then deploy the generated `dist/` directory as static files. No cloud functions or database are needed when there is no backend.

**Minimum steps**:

1. Register/sign in to Tencent Cloud and complete account real-name verification.
2. Create an environment in the CloudBase console and choose a mainland-China region.
3. Open Static Website Hosting and upload this project's `dist/` directory (`index.html` is the home page).
4. First validate the site on the domain provided by the platform. When you need a branded domain, bind it in domain management and follow the prompts to configure DNS/CNAME and an HTTPS certificate.

**Real-name verification, filing, and domains**: real-name verification is a practical prerequisite for enabling mainland-China cloud resources. When externally serving a mainland-China custom domain, complete website ICP filing as directed by the platform. Whether a temporary platform domain can be used long-term, and the free quota/prices, may change with the CloudBase plan and region; use the current console pricing as the source of truth.

**Domestic access and costs**: resources in a mainland-China region, combined with a domestic CDN, are generally more stable for mainland visitors. Small personal sites normally start with a free or low-tier plan; storage, outbound traffic, and requests over the free quota are billed.

Official entry points: [CloudBase product page](https://cloud.tencent.com/product/tcb) · [CloudBase documentation center](https://cloud.tencent.com/document/product/876)

## Option 2: Tencent Cloud COS + CDN

**Fit**: fully suitable for Vite. COS officially defines a static website as HTML and client-side scripts, and explicitly does not support server-side scripts such as PHP, JSP, or ASP.NET. This project is exactly that kind of static content.

**Minimum steps**:

1. Complete Tencent Cloud real-name verification and create a COS bucket in a mainland-China region.
2. Run `npm run build` locally and upload all files inside `dist/` to the bucket root.
3. Set the bucket access permission to “public read, private write.” Enable Static Website Hosting, set the home page to `index.html`, and optionally set the error page to `index.html` (especially useful for single-page-app routing).
4. Add a custom origin domain, select “static website origin” as the origin type, point the domain CNAME to COS, and bind a certificate for HTTPS.
5. Optional: add an acceleration domain in CDN and configure CDN to use COS as its origin; this is recommended for users across the country.

**Real-name verification, filing, and domains**: COS documentation states that buckets created after 2024-01-01 can no longer be previewed directly with a default COS (including static website) domain; static sites need a custom domain. Tencent Cloud's custom-origin-domain documentation also explicitly requires the supplied domain to be “ICP filed” and configured with CNAME. Therefore, for public access in mainland China, **domain ICP filing is effectively required**.

**Costs**: there is no server fee; COS charges for storage, requests, and outbound traffic, while CDN acceleration is billed separately. A small single-page site has few files, so cost usually depends on traffic rather than storage.

Official sources: [COS static website configuration](https://cloud.tencent.com/document/product/436/14984) · [COS custom origin domain (including “ICP-filed domain,” CNAME, and HTTPS)](https://cloud.tencent.com/document/product/436/36638) · [COS pricing](https://cloud.tencent.com/pricing/cos)

## Option 3: Alibaba Cloud OSS + CDN

**Fit**: fully suitable for Vite static output, with the same architecture as COS: OSS hosts `dist/` and CDN provides nationwide access acceleration.

**Minimum steps**:

1. Complete Alibaba Cloud real-name verification and create an OSS Bucket in a mainland-China region.
2. Run `npm run build`, upload the `dist/` files to the Bucket root, and make the required objects publicly readable.
3. Enable `index.html` as the home page in OSS Static Website Hosting; configure an error page when SPA fallback is needed.
4. Bind a custom domain and configure CNAME and an HTTPS certificate. To accelerate access, add the domain in CDN and use OSS as the origin.

**Real-name verification, filing, and domains**: a custom domain used in mainland China must meet Alibaba Cloud's filing-access requirements; buying a new domain does not mean filing is complete. After approval, bind the domain and configure DNS and the certificate. Do not treat OSS/COS default test domains as long-term public domains.

**Costs**: no always-on server cost; the primary charges are OSS storage, requests, and public outbound traffic, with CDN traffic billed separately. It suits users who already have Alibaba Cloud resources; calculate pricing from the purchase page using the selected region and actual traffic.

Official sources: [OSS static website hosting](https://help.aliyun.com/zh/oss/user-guide/static-website-hosting) · [OSS pricing](https://www.aliyun.com/price/product?spm=5176.7933691.J_3207526240.1.306a4a8fP7vseM&product=oss) · [Alibaba Cloud ICP filing](https://help.aliyun.com/zh/icp-filing/)

## Most practical choices for the current project

- **Temporary use by yourself or a small group of colleagues**: upload `dist/` through the CloudBase static-hosting console; no project-code changes are needed.
- **Stable, long-term public use**: buy a `.cn` / `.com` domain, complete personal-site ICP filing, then use **COS + CDN** or **OSS + CDN**. This is a domestic-route alternative to Vercel.
- **Project code remains on GitHub**: domestic object storage does not need to connect directly to GitHub. After each change, run `npm run build` and upload `dist/`; configure GitHub Actions or a cloud-development pipeline later if automation is needed. GitHub connectivity in mainland China can also affect automated builds, but not access to an already deployed website.

## Pre-release checklist

- `npm run build` succeeds, and you upload the files **inside** `dist/`, not the whole project directory.
- The home page is `index.html`, the HTTPS certificate is bound, and the DNS CNAME is effective.
- If the site uses a custom mainland-China domain, confirm that the ICP filing number is complete and display it in the page footer where required by the filing provider/regulator.
- This project's IndexedDB data is saved only for the user's current browser and current domain. After moving from Vercel to a new domain, focus records stored under the old domain will not migrate automatically.
