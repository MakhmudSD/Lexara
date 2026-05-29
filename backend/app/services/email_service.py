from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.config import Settings

logger = logging.getLogger(__name__)

_RESET_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Lexara password</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',system-ui,sans-serif;color:#e8e6e3;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#13131a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;max-width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f1428 100%);padding:32px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#e8e6e3;">Lexara</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#e8e6e3;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#9d9b96;">
                We received a request to reset the password for your Lexara account.
                Click the button below to choose a new password. This link expires in <strong style="color:#e8e6e3;">1 hour</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;">
                    <a href="{reset_url}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 32px;font-size:12px;color:#6366f1;word-break:break-all;">
                {reset_url}
              </p>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password won't change until you click the link above.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
              <p style="margin:0;font-size:12px;color:#4b5563;">
                &copy; 2026 Lexara &bull; AI-powered legal research
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_password_reset_email(settings: "Settings", to_email: str, reset_token: str) -> bool:
    """Send a password reset email via Resend. Returns True on success."""
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not configured — skipping password reset email")
        return False

    reset_url = f"https://lexara.app/reset-password?token={reset_token}"

    try:
        import resend  # type: ignore[import]

        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.from_email,
            "to": [to_email],
            "subject": "Reset your Lexara password",
            "html": _RESET_HTML.format(reset_url=reset_url),
        })
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False
