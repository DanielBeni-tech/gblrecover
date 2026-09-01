"""Schémas de pagination conformes à la spec API (§3.1).

La spec attend un objet `meta` avec `total`, `page`, `page_size` :

    {
      "items": [...],
      "meta": { "total": 123, "page": 1, "page_size": 25 }
    }

Les routes existantes renvoient encore `List[T]` pour rester rétrocompatibles.
Les nouvelles routes introduites par l'appendice spec adoptent ce format.
"""
from __future__ import annotations

from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PageMeta(BaseModel):
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)


class Page(BaseModel, Generic[T]):
    items: List[T]
    meta: PageMeta