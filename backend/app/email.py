from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.settings import settings


def send_email(*, to: str, subject: str, body_text: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise RuntimeError("SMTP not configured")

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body_text)

    if settings.smtp_use_tls:
        server: smtplib.SMTP = smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=10
        )
    else:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)

    try:
        server.ehlo()
        if settings.smtp_starttls and not settings.smtp_use_tls:
            server.starttls()
            server.ehlo()

        if settings.smtp_user:
            if not settings.smtp_password:
                raise RuntimeError("SMTP auth requires password")
            if server.has_extn("auth"):
                server.login(settings.smtp_user, settings.smtp_password)

        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass
