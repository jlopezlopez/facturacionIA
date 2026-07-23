from pydantic import BaseModel, Field
from datetime import date
from typing import List, Optional

# ==========================================
# 1. CONCEPTOS (LÍNEAS DE DETALLE)
# ==========================================
class ConceptoAlbaranBase(BaseModel):
    numeroconcepto: int = Field(..., description="Número de línea (1, 2, 3...)")
    descripcion: str = Field(..., max_length=100)
    cantidad: float
    preciounidad: float
    descuento: float = Field(0.0, description="Porcentaje de descuento (ej: 10.0 para 10%)")

class ConceptoAlbaranCreate(ConceptoAlbaranBase):
    pass

class ConceptoAlbaranResponse(ConceptoAlbaranBase):
    id_padre: int = Field(..., alias="id_documento", description="ID del Albaran o nota al que pertenece")

    class Config:
        from_attributes = True

# ==========================================
# 2. ALBARAN
# ==========================================
class AlbaranCreate(BaseModel):
    numeroalbaran: str = Field(..., max_length=15)
    fecha: date
    iva: float
    numerocliente: int
    aceptado: bool = False
    conceptos: List[ConceptoAlbaranCreate] # Un presupuesto se crea con sus líneas del tirón

class AlbaranResponse(BaseModel):
    id: int
    numeroalbaran: str
    fecha: date
    iva: float
    numerocliente: int
    aceptado: bool
    conceptos: List[ConceptoAlbaranBase] = []

    class Config:
        from_attributes = True

# ==========================================
# 3. NOTAS
# ==========================================
class NotasCreate(BaseModel):
    numeronota: str = Field(..., max_length=15)
    fecha: date
    iva: float
    numerocliente: int
    aceptado: bool = False
    conceptos: List[ConceptoAlbaranCreate] # Una nota se crea con sus líneas del tirón

class NotasResponse(BaseModel):
    id: int
    numeronota: str
    fecha: date
    iva: float
    numerocliente: int
    aceptado: bool
    conceptos: List[ConceptoAlbaranBase] = []

    class Config:
        from_attributes = True