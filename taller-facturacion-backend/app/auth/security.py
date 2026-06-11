import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import bcrypt # Usamos la librería bcrypt directamente para evitar problemas de bytes
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET", "una_clave_por_defecto_si_no_hay_env")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 día

# Encriptar contraseña
def obtener_password_hash(password: str) -> str:
    # Convertimos la contraseña a bytes (UTF-8)
    password_bytes = password.encode('utf-8')
    # Generamos la sal y el hash
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(password_bytes, salt)
    # Devolvemos el hash como string para guardarlo en la base de datos
    return hashed_bytes.decode('utf-8')

# Verificar si la contraseña coincide con el hash de la BD
def verificar_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

# Crear el Token JWT para el usuario
def crear_token_acceso(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt