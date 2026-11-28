from __future__ import annotations

import json
from collections.abc import Mapping

from pywebpush import webpush

_GONE_STATUSES = (404, 410)

_VAPID_MISMATCH_MARKERS = (
    "VapidPkHashMismatch",
    "do not correspond to the credentials used to create the subscriptions",
)


def subscription_rejected(exc: BaseException) -> bool:
    """Whether the push service rejected this subscription for good.

    404/410 mean the subscription is gone. 400/403 are only treated as
    permanent when the push service reports a VAPID key mismatch: the
    subscription was created with a different application server key than the
    one the server signs with, so it can never be delivered to again.
    """
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None) or getattr(response, "status", None)
    if status in _GONE_STATUSES:
        return True
    if status in (400, 403):
        body = getattr(response, "text", "") or ""
        return any(marker in body for marker in _VAPID_MISMATCH_MARKERS)
    return False


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
