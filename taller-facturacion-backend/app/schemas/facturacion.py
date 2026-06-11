from pydantic import BaseModel, Field
from datetime import date
from typing import List, Optional

# ==========================================
# 1. CONCEPTOS (LÍNEAS DE DETALLE)
# ==========================================
class ConceptoBase(BaseModel):
    numeroconcepto: int = Field(..., description="Número de línea (1, 2, 3...)")
    descripcion: str = Field(..., max_length=100)
    cantidad: float
    preciounidad: float
    descuento: float = Field(0.0, description="Porcentaje de descuento (ej: 10.0 para 10%)")

class ConceptoCreate(ConceptoBase):
    pass

class ConceptoResponse(ConceptoBase):
    id_padre: int = Field(..., alias="id_documento", description="ID de la factura o presupuesto al que pertenece")

    class Config:
        from_attributes = True

# ==========================================
# 2. PRESUPUESTOS
# ==========================================
class PresupuestoCreate(BaseModel):
    numeropresupuesto: str = Field(..., max_length=15)
    fecha: date
    iva: float
    numerocliente: int
    aceptado: bool = False
    conceptos: List[ConceptoCreate] # Un presupuesto se crea con sus líneas del tirón

class PresupuestoResponse(BaseModel):
    id: int
    numeropresupuesto: str
    fecha: date
    iva: float
    numerocliente: int
    aceptado: bool
    conceptos: List[ConceptoBase] = []

    class Config:
        from_attributes = True

# ==========================================
# 3. FACTURAS
# ==========================================
class FacturaCreate(BaseModel):
    numerofactura: str = Field(..., max_length=15)
    fecha: date
    iva: float
    numerocliente: int
    pagado: bool = False
    conceptos: List[ConceptoCreate] # Una factura se crea con sus líneas del tirón

class FacturaResponse(BaseModel):
    id: int
    numerofactura: str
    fecha: date
    iva: float
    numerocliente: int
    pagado: bool
    conceptos: List[ConceptoBase] = []

    class Config:
        from_attributes = True