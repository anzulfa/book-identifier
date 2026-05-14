import json
import os
import re

import anthropic

_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
_MODEL = "claude-haiku-4-5-20251001"


def _top_review_bodies(reviews: list, n: int = 6) -> str:
    texts = []
    for r in reviews[:n]:
        body = (r.get("body") or "").strip()
        if body:
            texts.append(body)
    return "\n\n---\n\n".join(texts)


async def summarize_book_content(description: str, reviews: list) -> tuple[str, str]:
    """
    Returns (plot_summary, reviews_summary) as 4-5 sentence strings.
    Falls back to sentence extraction if Claude fails.
    """
    reviews_text = _top_review_bodies(reviews)

    prompt_parts = []
    if description:
        prompt_parts.append(f"BOOK DESCRIPTION:\n{description}")
    if reviews_text:
        prompt_parts.append(f"READER REVIEWS (sample):\n{reviews_text}")

    if not prompt_parts:
        return "", ""

    sections = "\n\n".join(prompt_parts)
    prompt = f"""{sections}

Respond with a JSON object containing exactly two keys:
- "plot_summary": 3-4 sentences summarising the plot or main content from the description. If no description is provided, use an empty string.
- "reviews_summary": 3-4 sentences summarising what readers overall think — their general sentiment, what they praise or criticise, and what kind of reader it appeals to. Write in third person (e.g. "Readers praise...", "Many find..."). Do NOT quote or paraphrase any single review. If no reviews are provided, use an empty string.

Return only the raw JSON, no markdown fences."""

    try:
        response = await _client.messages.create(
            model=_MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        result = json.loads(text)
        return result.get("plot_summary", ""), result.get("reviews_summary", "")
    except Exception:
        # Fallback: extract first sentences directly
        plot = _first_n_sentences(description, 4)
        reviews_fb = _first_n_sentences(reviews_text.replace("\n\n---\n\n", " "), 4)
        return plot, reviews_fb


def _first_n_sentences(text: str, n: int) -> str:
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(sentences[:n])
