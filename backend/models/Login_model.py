from pydantic import BaseModel

class LoginRequest(BaseModel):
    role: str
    identifier: str  # This will be the Customer ID or Officer ID
    pin: str