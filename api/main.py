# main.py
# Backend de nuestra página tipo Pinterest
# API REST simple que devuelve y gestiona posts (imágenes tipo feed)
# y expone un endpoint /api/discover que llama a Unsplash.

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

import os
import requests  # para llamar a Unsplash desde el backend

app = FastAPI(title="Pinterest-like Posts API")

# CORS para permitir que el frontend (localhost, etc.) acceda a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # permite cualquier origen. Cambiar cuando tengamos dominio.
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Config Unsplash
# -----------------------------

UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")


# -----------------------------
# Modelos de datos
# -----------------------------

class Post(BaseModel):
    id: int
    usuario: str                 # quién creó el post
    fecha_alta: datetime         # fecha de alta del post
    titulo: str
    imagen: str                  # URL de la imagen
    descripcion: Optional[str] = None
    url: Optional[str] = None    # link externo opcional
    tags: Optional[List[str]] = []
    alt: Optional[str] = None


class PostCreate(BaseModel):
    # Lo que recibe el backend al crear un post (sin id, sin usuario, sin fecha_alta)
    titulo: str
    imagen: str                  # URL de la imagen
    descripcion: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[List[str]] = []
    alt: Optional[str] = None


class PostUpdate(BaseModel):
    # Lo que se puede actualizar (todos opcionales)
    titulo: Optional[str] = None
    imagen: Optional[str] = None
    descripcion: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[List[str]] = None
    alt: Optional[str] = None


# Modelo para las imágenes de discover (Unsplash ya transformadas)
class DiscoverImage(BaseModel):
    id: str
    descripcion: Optional[str] = None
    url_imagen: str           # URL para mostrar en el front
    url_full: str             # Link a la foto en Unsplash
    autor: str
    perfil_autor: str


# -----------------------------
# "Base de datos" en memoria
# -----------------------------

DB: List[Post] = []
NEXT_ID = 1


def seed():
    """Semilla de datos iniciales para el feed."""
    global NEXT_ID, DB

    posts_iniciales = [
        Post(
            id=NEXT_ID,
            usuario="admin",
            fecha_alta=datetime(2025, 10, 24, 0, 0, 0),
            titulo="Atardecer en la ciudad",
            imagen="img-seed/city-sunset.jpg",
            descripcion="Un atardecer naranja en la ciudad con rascacielos.",
            url=None,
            tags=["ciudad", "atardecer", "paisaje"],
            alt="Foto de un atardecer en la ciudad"
        ),
        Post(
            id=NEXT_ID + 1,
            usuario="admin",
            fecha_alta=datetime(2025, 10, 24, 0, 1, 0),
            titulo="Café y estudio",
            imagen="img-seed/coffee-study.jpg",
            descripcion="Escritorio con una laptop, café y apuntes.",
            url=None,
            tags=["estudio", "café", "productividad"],
            alt="Taza de café junto a una laptop"
        ),
        Post(
            id=NEXT_ID + 2,
            usuario="tania",
            fecha_alta=datetime(2025, 10, 23, 0, 0, 0),
            titulo="Paisaje de montaña",
            imagen="img-seed/mountain-landscape.jpg",
            descripcion="Montañas nevadas y un lago tranquilo.",
            url=None,
            tags=["montaña", "naturaleza", "viaje"],
            alt="Montañas nevadas frente a un lago"
        ),
        Post(
            id=NEXT_ID + 3,
            usuario="tania",
            fecha_alta=datetime(2025, 10, 22, 0, 0, 0),
            titulo="Setup minimalista",
            imagen="img-seed/minimal-setup.jpg",
            descripcion="Escritorio minimalista con monitor y accesorios.",
            url=None,
            tags=["setup", "minimalismo", "tecnología"],
            alt="Escritorio minimalista con monitor"
        ),
    ]

    DB.extend(posts_iniciales)
    NEXT_ID += len(posts_iniciales)


seed()


# -----------------------------
# Endpoints feed (posts)
# -----------------------------

@app.get("/")
def health():
    """Endpoint simple para verificar que la API está viva."""
    return {"ok": True, "count": len(DB)}


@app.get("/api/posts", response_model=List[Post])
def listar_posts(
    skip: int = 0,
    limit: int = 10,
):
    """
    Lista posts del feed con paginación simple (sin min_date por ahora).
    """
    if skip < 0:
        skip = 0
    if limit <= 0:
        limit = 10

    posts = DB
    return posts[skip: skip + limit]


@app.get("/api/posts/{post_id}", response_model=Post)
def obtener_post(post_id: int):
    """Obtiene un solo post por id."""
    for p in DB:
        if p.id == post_id:
            return p
    raise HTTPException(status_code=404, detail="Post no encontrado")


@app.post("/api/posts", response_model=Post)
def crear_post(
    post_in: PostCreate,
    x_user: str = Header(..., alias="X-User")
):
    """
    Crea un nuevo post.
    - El usuario que lo crea viene en el header X-User.
    - La fecha_alta la pone el servidor (UTC).
    """
    global NEXT_ID, DB

    if not post_in.titulo:
        raise HTTPException(status_code=400, detail="El título es obligatorio")
    if not post_in.imagen:
        raise HTTPException(status_code=400, detail="La imagen es obligatoria")

    post = Post(
        id=NEXT_ID,
        usuario=x_user,
        fecha_alta=datetime.utcnow(),
        titulo=post_in.titulo,
        imagen=post_in.imagen,
        descripcion=post_in.descripcion,
        url=post_in.url,
        tags=post_in.tags,
        alt=post_in.alt or post_in.titulo
    )
    NEXT_ID += 1
    DB.append(post)
    return post


@app.put("/api/posts/{post_id}", response_model=Post)
def actualizar_post(
    post_id: int,
    post_in: PostUpdate,
    x_user: str = Header(..., alias="X-User")
):
    """
    Actualiza un post existente.
    Solo puede hacerlo el usuario que lo creó (usuario == X-User).
    """
    for i, post in enumerate(DB):
        if post.id == post_id:
            # Validar propietario
            if post.usuario != x_user:
                raise HTTPException(status_code=403, detail="No puedes modificar este post")

            data = post.model_dump()
            if post_in.titulo is not None:
                data["titulo"] = post_in.titulo
            if post_in.imagen is not None:
                data["imagen"] = post_in.imagen
            if post_in.descripcion is not None:
                data["descripcion"] = post_in.descripcion
            if post_in.url is not None:
                data["url"] = post_in.url
            if post_in.tags is not None:
                data["tags"] = post_in.tags
            if post_in.alt is not None:
                data["alt"] = post_in.alt

            post_actualizado = Post(**data)
            DB[i] = post_actualizado
            return post_actualizado

    raise HTTPException(status_code=404, detail="Post no encontrado")


@app.delete("/api/posts/{post_id}", status_code=204)
def eliminar_post(
    post_id: int,
    x_user: str = Header(..., alias="X-User")
):
    """
    Elimina un post.
    Solo puede hacerlo el usuario que lo creó (usuario == X-User).
    """
    for i, post in enumerate(DB):
        if post.id == post_id:
            if post.usuario != x_user:
                raise HTTPException(status_code=403, detail="No puedes eliminar este post")
            DB.pop(i)
            return

    raise HTTPException(status_code=404, detail="Post no encontrado")


# -----------------------------
# Endpoint Discover (Unsplash)
# -----------------------------

@app.get("/api/discover", response_model=List[DiscoverImage])
def discover_images(count: int = 9):
    """
    Devuelve imágenes 'aleatorias' desde Unsplash, transformadas
    para que el frontend solo reciba lo necesario para renderizar.
    """
    if UNSPLASH_ACCESS_KEY is None:
        raise HTTPException(
            status_code=500,
            detail="Unsplash no está configurado en el servidor."
        )

    # Limitar por las reglas de Unsplash (count max ~30 en /photos/random)
    if count < 1:
        count = 1
    if count > 30:
        count = 30

    url = "https://api.unsplash.com/photos/random"
    params = {
        "count": count,
        # aquí podrías agregar filtros si quieres:
        # "query": "landscape",
        # "orientation": "portrait",
    }
    headers = {
        "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=5)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="No se pudo conectar con la API de Unsplash."
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="Error al consultar Unsplash."
        )

    data = resp.json()

    # /photos/random con count>1 regresa lista; sin count regresa un solo objeto
    if isinstance(data, dict):
        data = [data]

    resultado: List[DiscoverImage] = []
    for item in data:
        desc = item.get("description") or item.get("alt_description")

        urls = item.get("urls", {})
        links = item.get("links", {})
        user  = item.get("user", {})
        user_links = user.get("links", {})

        img = DiscoverImage(
            id=item.get("id", ""),
            descripcion=desc,
            url_imagen=urls.get("small") or urls.get("regular") or "",
            url_full=links.get("html") or "",
            autor=user.get("name") or "Desconocido",
            perfil_autor=user_links.get("html") or ""
        )
        resultado.append(img)

    return resultado
