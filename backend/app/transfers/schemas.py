from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# Traslados entre Almacenes (M18)
class TransferLineCreate(BaseModel):
    item_id: UUID
    presentation_id: Optional[UUID] = None
    qty_sent_presentation: float

class TransferCreate(BaseModel):
    origin_warehouse_id: UUID
    destination_warehouse_id: UUID
    notes: Optional[str] = None
    auto_confirm: bool = False
    lines: List[TransferLineCreate]

class TransferLineConfirm(BaseModel):
    id: UUID # ID of the transfer_document_line
    qty_received_presentation: float

class TransferConfirm(BaseModel):
    notes: Optional[str] = None
    lines: List[TransferLineConfirm]

class TransferResponse(BaseModel):
    id: UUID
    status: str
    origin_warehouse_id: UUID
    destination_warehouse_id: UUID
    created_at: datetime
