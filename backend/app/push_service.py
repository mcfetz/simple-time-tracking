from __future__ import annotations

import json

from pywebpush import webpush


def send_web_push(
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    vapid_public_key: str,
    vapid_private_key: str,
    vapid_subject: str,
    payload: dict[str, object],
) -> None:
    subscription_info = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }

    webpush(
        subscription_info,
        json.dumps(payload),
        vapid_private_key=vapid_private_key,
        vapid_claims={"sub": vapid_subject},
    )
