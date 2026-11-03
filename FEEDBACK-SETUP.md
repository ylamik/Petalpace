# Feedback email setup

The form sends a request to the Node server, which uses Resend to deliver feedback to `carasmikyla02@gmail.com`. A visitor does not need an email address. If provided, it becomes Reply-To so you can reply from your inbox. The site does not send an automatic email to the visitor.

## Enable delivery

1. Create a Resend account and configure an approved sender. For production, verify a domain you own. See https://resend.com/docs/dashboard/domains/introduction and https://resend.com/docs/api-reference/emails/send-email.
2. Copy `.env.example` to `.env.local` in the project root.
3. Put the API key in `RESEND_API_KEY` and approved sender in `FEEDBACK_FROM`. Keep `FEEDBACK_TO=carasmikyla02@gmail.com`. Do not paste your key in chat or put it in frontend code.
4. Restart `npm run dev`. This now runs both Vite and the feedback API. If Vite uses a different port, add its exact URL to `APP_ORIGINS` and restart.
5. Submit one feedback message without an email, then one with your email. Check the destination inbox/spam folder and verify Reply-To. Until credentials are configured, the form reports that delivery is unavailable; it never claims a successful send.

## Hosting

This is a Node backend, not a static-only deployment. Run `npm run start:api` on your Node host and route the public site's `/api/feedback` path to it. Vite's proxy only runs in development. Set the production domain in `APP_ORIGINS` and store the server environment values in your host's secret settings. The API binds to loopback for a same-machine reverse proxy. Add a gateway rate limit for public deployment: the included limit is per server instance/socket address and does not trust forwarded IP headers. For multiple instances, use a shared limiter. `FEEDBACK_PORT` must match the proxy configuration if changed.

The server validates input, limits request sizes and submission rate, and sends plain text. It doesn't store message bodies or email addresses. Local tests mock Resend and do not send real messages. Delivery to an inbox has not been verified until you complete step 5.
