from __future__ import annotations

import json
from collections.abc import Mapping

from pywebpush import webpush


def send_web_push(
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    vapid_public_key: str,
    vapid_private_key: str,
    vapid_subject: str,
    payload: Mapping[str, object],
) -> None:
    subscription_info: dict[str, str | bytes | dict[str, str | bytes]] = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }

    webpush(
        subscription_info,
        json.dumps(payload),
        vapid_private_key=vapid_private_key,
        vapid_claims={"sub": vapid_subject},
    )
