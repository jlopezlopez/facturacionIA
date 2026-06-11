import os
from contextlib import contextmanager
from psycopg_pool import ConnectionPool # Nueva forma de importar el Pool en Psycopg 3
from dotenv import load_dotenv

# Cargar variables del archivo .env
load_dotenv()

# Construimos la cadena de conexión (DSN) que pide Psycopg 3
conn_str = f"host={os.getenv('DB_HOST')} dbname={os.getenv('DB_NAME')} user={os.getenv('DB_USER')} password={os.getenv('DB_PASSWORD')} port={os.getenv('DB_PORT')}"

try:
    # Inicializamos el Pool de conexiones moderno
    connection_pool = ConnectionPool(conninfo=conn_str, min_size=1, max_size=10)
    print("¡Pool de conexiones con PostgreSQL (Psycopg 3) creado con éxito!")
except Exception as e:
    print(f"Error al conectar a la base de datos: {e}")
    connection_pool = None

@contextmanager
def get_db_connection():
    if connection_pool is None:
        raise Exception("El pool de conexiones no está inicializado.")
    
    # Solicitamos una conexión al pool
    with connection_pool.connection() as connection:
        yield connection
        # Al salir del bloque 'with', la conexión se devuelve automáticamente al pool