import json
import re
import anthropic

_MODEL = "claude-haiku-4-5-20251001"
_PROMPT = (
    'Extract book title and author from this image. '
    'Return JSON only: {"title": "...", "author": "..."}'
)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()
    return _client


def _parse_media_type(image_base64: str) -> tuple[str, str]:
    """Strip data URL prefix and return (media_type, raw_b64)."""
    if not image_base64.startswith("data:"):
        return "image/jpeg", image_base64

    header, raw = image_base64.split(",", 1)
    if "png" in header:
        return "image/png", raw
    if "gif" in header:
        return "image/gif", raw
    if "webp" in header:
        return "image/webp", raw
    return "image/jpeg", raw


async def extract_title_from_image(image_base64: str) -> dict:
    media_type, raw_b64 = _parse_media_type(image_base64)

    message = await _get_client().messages.create(
        model=_MODEL,
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": raw_b64},
                    },
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
    )

    text = message.content[0].text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)
