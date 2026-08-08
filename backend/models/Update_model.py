from pydantic import BaseModel
from typing import Optional

class UpdateStatus(BaseModel):
    claim_id:str
    claim_status:str
    rejection_reason:Optional[str] = None
    employee_id:str