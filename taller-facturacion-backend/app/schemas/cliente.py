from pydantic import BaseModel, Field
from typing import Optional

# Lo que se necesita para crear o actualizar un cliente
class ClienteBase(BaseModel):
    NIF: str = Field(..., max_length=15, description="Identificación fiscal (DNI/NIE/CIF)")
    razonsocial: Optional[str] = Field(None, max_length=100)
    calle: Optional[str] = Field(None, max_length=50)
    numero: Optional[str] = Field(None, max_length=50)
    piso: Optional[str] = Field(None, max_length=10)
    poblacion: Optional[str] = Field(None, max_length=30)
    provincia: Optional[str] = Field(None, max_length=30)
    CP: Optional[int] = None
    telefono: Optional[str] = Field(None, max_length=50)
    observaciones: Optional[str] = Field(None, max_length=160)

class ClienteCreate(ClienteBase):
    pass

# Lo que la API devuelve (incluye el ID que genera la base de datos)
class ClienteResponse(ClienteBase):
    id: int

    class Config:
        from_attributes = True