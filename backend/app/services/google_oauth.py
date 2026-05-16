import httpx

_http_client = httpx.AsyncClient(timeout=10.0)


async def get_google_user_info(access_token: str) -> dict:
    resp = await _http_client.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    resp.raise_for_status()
    return resp.json()  # {sub, email, name, picture}
