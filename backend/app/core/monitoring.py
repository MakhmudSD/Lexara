from __future__ import annotations

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
except ImportError:  # pragma: no cover - optional dependency in local dev
    sentry_sdk = None
    FastApiIntegration = None
    SqlalchemyIntegration = None


def init_sentry(dsn: str | None, environment: str) -> None:
    if not dsn or sentry_sdk is None:
        return
    sentry_sdk.init(
        dsn=dsn,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        environment=environment,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
