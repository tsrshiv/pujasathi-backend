# Email delivery setup

The backend prefers the Resend HTTPS API to avoid SMTP ports that may be
unavailable from the hosting provider.

Configure these environment variables for the backend service:

- `RESEND_API_KEY`: API key created in the Resend dashboard.
- `RESEND_FROM_EMAIL`: sender using a domain verified in Resend, for example
  `PujaSathi <noreply@mail.example.com>`.

Verify the sending domain in Resend and publish the DNS records it provides
before using the sender for customer registration OTPs. Keep the API key in
the hosting provider's secret environment-variable settings; never commit it
to the repository.

For local development only, the backend can fall back to Gmail SMTP when
`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are not set, using `SMTP_EMAIL` and
`SMTP_PASSWORD` with STARTTLS on port 587. The hosting provider may block
outbound SMTP, so production should use Resend.

After setting the variables, redeploy the backend. If email sending fails, the
registration endpoint returns an error. Check the backend logs and Resend
dashboard for provider errors and delivery status.
