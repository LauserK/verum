# backend/app/integrations/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class QuickCatalogPreviewResponse(BaseModel):
    total_categories: int = 0
    new_categories: int = 0
    existing_categories: int = 0
    total_modifier_groups: int = 0
    new_modifier_groups: int = 0
    existing_modifier_groups: int = 0
    total_products: int = 0
    new_products: int = 0
    existing_products: int = 0
    categories_sample: List[str] = []
    modifier_groups_sample: List[str] = []
    products_sample: List[str] = []

class QuickCatalogImportRequest(BaseModel):
    overwrite_existing_prices: bool = True
    match_by: str = "name_or_code"

class QuickCatalogImportResponse(BaseModel):
    status: str = "success"
    categories_imported: int = 0
    modifier_groups_imported: int = 0
    modifier_options_imported: int = 0
    products_created: int = 0
    products_updated: int = 0
    variants_imported: int = 0
    product_modifier_links_created: int = 0
