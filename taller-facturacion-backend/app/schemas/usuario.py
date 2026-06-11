from pydantic import BaseModel, EmailStr, Field
from datetime import date
from typing import Optional
from enum import Enum

class TipoUsuarioEnum(str, Enum):
    Admin = "Admin"
    usuario = "usuario"
    cliente = "cliente"

# Lo que pedimos cuando alguien se registra
class UsuarioCreate(BaseModel):
    nombre: str = Field(..., max_length=250)
    usuario: str = Field(..., max_length=150)
    password: str = Field(..., min_length=6, max_length=100)
    email: EmailStr
    tipoUsuario: TipoUsuarioEnum = TipoUsuarioEnum.usuario
    fechaNacimiento: Optional[date] = None

# Lo que pedimos para iniciar sesión
class LoginRequest(BaseModel):
    usuario: str
    password: str

# Lo que devolvemos al cliente (sin la contraseña por seguridad)
class UsuarioResponse(BaseModel):
    id: int
    nombre: Optional[str]
    usuario: Optional[str]
    email: Optional[str]
    tipoUsuario: str
    fechaNacimiento: Optional[date] = None

    class Config:
        from_attributes = True