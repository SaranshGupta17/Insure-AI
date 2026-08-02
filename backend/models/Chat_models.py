from pydantic import BaseModel
from typing import List

# ==========================================
# 1. PYDANTIC MODELS FOR HTTP REQUESTS
# ==========================================
class ChatRequest(BaseModel):
    query: str
    customer_id: str
    
class ChatResponse(BaseModel):
    answer: str
    source_documents: List[str]=None