import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./App.css";

// ---------------------- CONFIG API ----------------------
const isLocal =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost";

const API = isLocal
  ? "http://127.0.0.1:8000"
  : "http://127.0.0.1:8000"; // cambiar por dominio cuando esté en producción

function getUsuarioActual() {
  // unificado (no mezclar "anon"/"anonymus")
  return sessionStorage.getItem("usuarioActual") || "anon";
}

// ---------------------- CARD ----------------------
function PostCard({ post, onEdit, onDelete }) {
  const fecha = new Date(post.fecha_alta || post.fecha || post.timestamp);
  const when = fecha.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const tags = (post.tags || []).map((t) => (
    <span key={t} className="badge rounded-pill text-bg-secondary me-1">
      {t}
    </span>
  ));

  const hasImage = post.imagen && post.imagen.trim() !== "";

  const img = hasImage ? (
    <img
      src={post.imagen}
      className="card-img-top"
      alt={post.alt || post.titulo}
      onError={(e) => {
        console.warn("Imagen no encontrada:", e.currentTarget.src);
        e.currentTarget.remove();
      }}
    />
  ) : null;

  const content = post.url ? (
    <a href={post.url} target="_blank" rel="noopener noreferrer">
      {img}
    </a>
  ) : (
    img
  );

  const usuarioActual = getUsuarioActual();
  const esMio =
    (post.usuario || "").trim() === (usuarioActual || "").trim();

  return (
    <div className="col-12 col-sm-6 col-lg-4">
      <div className="card bg-dark text-light border-0 h-100">
        {content}
        <div className="card-body">
          <h5 className="card-title">{post.titulo}</h5>
          <p className="small text-muted">
            {when} · Publicado por: <strong>{post.usuario}</strong>
          </p>

          {post.descripcion && <p className="card-text">{post.descripcion}</p>}

          <div className="d-flex justify-content-center align-items-center gap-2 flex-wrap">
            {post.url && (
              <a
                href={post.url}
                className="btn btn-success btn-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver más
              </a>
            )}

            {esMio && (
              <button
                className="btn btn-outline-warning btn-sm"
                onClick={() => onEdit && onEdit(post)}
              >
                Editar
              </button>
            )}

            {esMio && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => onDelete && onDelete(post)}
              >
                Eliminar
              </button>
            )}
          </div>

          {tags.length > 0 && <div className="mt-2">{tags}</div>}
        </div>
      </div>
    </div>
  );
}

// ---------------------- USER SELECTOR ----------------------
function UserSelector() {
  const [input, setInput] = useState("");
  const [usuarioActual, setUsuarioActual] = useState("anon");

  useEffect(() => {
    const u = sessionStorage.getItem("usuarioActual") || "anon";
    setUsuarioActual(u);
  }, []);

  function actualizarUsuario() {
    const nombre = input.trim();
    if (nombre) {
      sessionStorage.setItem("usuarioActual", nombre);
      setUsuarioActual(nombre);
    } else {
      sessionStorage.removeItem("usuarioActual");
      setUsuarioActual("anon");
    }
  }

  return (
    <section className="mb-4">
      <h1 className="h4 mb-3">Mini feed tipo Pinterest</h1>
      <div className="row g-2 align-items-center">
        <div className="col-sm-6 col-md-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="nombre de usuario (ej. tania)"
          />
        </div>
        <div className="col-sm-6 col-md-4">
          <button onClick={actualizarUsuario} className="btn btn-sm btn-success">
            Usar este usuario
          </button>
        </div>
        <div className="col-12 mt-2">
          <small className="text-muted">
            Usuario actual: <strong>{usuarioActual}</strong>
          </small>
        </div>
      </div>
    </section>
  );
}

// ---------------------- BUSCAR POR ID ----------------------
function SearchById({ onResult }) {
  const [id, setId] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanId = id.trim();
    if (!cleanId) return;

    try {
      setMsg("Buscando post...");
      const res = await fetch(`${API}/api/posts/${cleanId}`);

      if (res.status === 404) {
        setMsg("Post no encontrado");
        onResult(null);
        return;
      }

      if (!res.ok) throw new Error("Error al obtener el post");
      const post = await res.json();
      onResult(post);
      setMsg("Post cargado correctamente.");
    } catch (err) {
      console.error(err);
      setMsg("Error al consultar el post.");
      onResult(null);
    }
  }

  return (
    <section className="mb-4">
      <h2 className="h6 mb-2">Buscar post por ID</h2>
      <form onSubmit={handleSubmit} className="row g-2">
        <div className="col-sm-4 col-md-3">
          <input
            type="number"
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </div>
        <div className="col-sm-4 col-md-2">
          <button type="submit" className="btn btn-sm btn-primary">
            Buscar
          </button>
        </div>
      </form>
      <p className="text-muted small mt-2">{msg}</p>
    </section>
  );
}

// ---------------------- CREAR POST ----------------------
function CreatePostForm({ onCreated }) {
  const [titulo, setTitulo] = useState("");
  const [imagen, setImagen] = useState("");
  const [url, setUrl] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    const cleanTitulo = titulo.trim();
    const cleanImagen = imagen.trim();
    const cleanUrl = url.trim() || null;
    const cleanDesc = descripcion.trim() || null;

    const tags =
      tagsStr.trim() === ""
        ? []
        : tagsStr
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

    if (!cleanTitulo || !cleanImagen) {
      setMsg("El título y la URL de la imagen son obligatorios.");
      return;
    }

    const nuevoPost = {
      titulo: cleanTitulo,
      imagen: cleanImagen,
      descripcion: cleanDesc,
      url: cleanUrl,
      tags,
      alt: cleanTitulo,
    };

    const usuarioActual = getUsuarioActual();

    try {
      setMsg("Guardando post...");
      const res = await fetch(`${API}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User": usuarioActual,
        },
        body: JSON.stringify(nuevoPost),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error backend:", errText);
        setMsg("Error al guardar el post.");
        return;
      }

      setTitulo("");
      setImagen("");
      setUrl("");
      setDescripcion("");
      setTagsStr("");

      setMsg("Post guardado correctamente.");
      onCreated && onCreated();
    } catch (err) {
      console.error(err);
      setMsg("No se pudo guardar el post.");
    }
  }

  return (
    <section className="mb-4">
      <h2 className="h6 mb-2">Crear nuevo post</h2>
      <form onSubmit={handleSubmit} className="row g-2">
        <div className="col-md-4">
          <label className="form-label small">Título</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label small">URL de imagen</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="https://..."
            value={imagen}
            onChange={(e) => setImagen(e.target.value)}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label small">Link externo (opcional)</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label small">Descripción (opcional)</label>
          <textarea
            rows="2"
            className="form-control form-control-sm bg-dark text-light border-secondary"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label small">Etiquetas (coma)</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="viaje, paisaje"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-sm btn-success mt-2">
            Guardar post
          </button>
        </div>
      </form>
      <p className="text-muted small mt-2">{msg}</p>
    </section>
  );
}

// ---------------------- ACTUALIZAR POST (sin input de ID) ----------------------
function UpdatePostForm({ onUpdated, editingPost, clearEditing }) {
  const [editingId, setEditingId] = useState(null);

  const [titulo, setTitulo] = useState("");
  const [imagen, setImagen] = useState("");
  const [url, setUrl] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [msg, setMsg] = useState("");

  // Autofill cuando seleccionas "Editar"
  useEffect(() => {
    if (!editingPost) return;

    setEditingId(editingPost.id);
    setTitulo(editingPost.titulo || "");
    setImagen(editingPost.imagen || "");
    setUrl(editingPost.url || "");
    setDescripcion(editingPost.descripcion || "");
    setTagsStr(
      Array.isArray(editingPost.tags) ? editingPost.tags.join(", ") : ""
    );

    setMsg(`Editando post #${editingPost.id}`);
  }, [editingPost]);

  async function handleSubmit(e) {
    e.preventDefault();

    const postId = editingId;
    if (!postId) {
      setMsg("Selecciona un post para editar (usa el botón Editar).");
      return;
    }

    const body = {};
    if (titulo.trim()) body.titulo = titulo.trim();
    if (imagen.trim()) body.imagen = imagen.trim();
    if (url.trim()) body.url = url.trim();
    if (descripcion.trim()) body.descripcion = descripcion.trim();
    if (tagsStr.trim()) {
      body.tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    const usuarioActual = getUsuarioActual();

    try {
      setMsg("Actualizando post...");
      const res = await fetch(`${API}/api/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User": usuarioActual,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        setMsg("No tienes permisos para modificar este post.");
        return;
      }

      if (res.status === 404) {
        setMsg("Post no encontrado.");
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error backend:", errText);
        setMsg("Error al actualizar el post.");
        return;
      }

      // limpiar edición
      setEditingId(null);
      clearEditing && clearEditing();

      setTitulo("");
      setImagen("");
      setUrl("");
      setDescripcion("");
      setTagsStr("");

      setMsg("Post actualizado.");
      onUpdated && onUpdated();
    } catch (err) {
      console.error(err);
      setMsg("No se pudo actualizar el post.");
    }
  }

  return (
    <section className="mb-4">
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h6 mb-2">Actualizar post</h2>

        {editingId && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setEditingId(null);
              clearEditing && clearEditing();
              setTitulo("");
              setImagen("");
              setUrl("");
              setDescripcion("");
              setTagsStr("");
              setMsg("Edición cancelada.");
            }}
          >
            Cancelar
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="row g-2">
        <div className="col-md-4">
          <label className="form-label small">Título (opcional)</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label small">URL de imagen (opcional)</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="https://..."
            value={imagen}
            onChange={(e) => setImagen(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label small">Link externo (opcional)</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label small">Descripción (opcional)</label>
          <textarea
            rows="2"
            className="form-control form-control-sm bg-dark text-light border-secondary"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <div className="col-12">
          <label className="form-label small">Etiquetas (coma, opcional)</label>
          <input
            className="form-control form-control-sm bg-dark text-light border-secondary"
            placeholder="viaje, paisaje"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-sm btn-warning mt-2">
            Actualizar post
          </button>
        </div>
      </form>

      <p className="text-muted small mt-2">{msg}</p>
    </section>
  );
}

// ---------------------- FEED PAGE ----------------------
function FeedPage() {
  const [paginaActual, setPaginaActual] = useState(0);
  const [posts, setPosts] = useState([]);
  const [msg, setMsg] = useState("Cargando...");
  const [busquedaPost, setBusquedaPost] = useState(null);

  const [editingPost, setEditingPost] = useState(null);

  const limit = 9;

  useEffect(() => {
    cargar(paginaActual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual]);

  async function cargar(pagina = 0) {
    pagina = Number(pagina) || 0;
    const skip = pagina * limit;

    const url = `${API}/api/posts?skip=${skip}&limit=${limit}`;

    try {
      setMsg("Cargando posts...");

      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al obtener posts");

      const data = await res.json();
      setPosts(data);
      setMsg(`Página ${pagina + 1} (${data.length} posts cargados)`);
    } catch (e) {
      console.error(e);
      setMsg("No se pudieron cargar los posts.");
    }
  }

  function startEdit(post) {
    setEditingPost(post);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  function clearEditing() {
    setEditingPost(null);
  }

  async function handleDelete(post) {
    const ok = window.confirm(`¿Eliminar el post #${post.id}?`);
    if (!ok) return;

    const usuarioActual = getUsuarioActual();

    try {
      const res = await fetch(`${API}/api/posts/${post.id}`, {
        method: "DELETE",
        headers: {
          "X-User": usuarioActual,
        },
      });

      if (res.status === 403) {
        alert("No tienes permisos para eliminar este post.");
        return;
      }

      if (res.status === 404) {
        alert("Post no encontrado.");
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error backend:", errText);
        alert("Error al eliminar el post.");
        return;
      }

      // si estabas editando este post, limpia edición
      if (editingPost?.id === post.id) clearEditing();

      await cargar(paginaActual);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el post.");
    }
  }

  return (
    <>
      <UserSelector />

      <section className="mb-2">
        <p className="text-muted small">{msg}</p>
      </section>

      <section className="mb-2">
        <div className="row g-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </section>

      <section className="mb-4">
        <div className="d-flex justify-content-center gap-2">
          <button
            className="btn btn-outline-light btn-sm"
            onClick={() => setPaginaActual((p) => (p > 0 ? p - 1 : 0))}
            disabled={paginaActual === 0}
          >
            Anterior
          </button>
          <button
            className="btn btn-outline-light btn-sm"
            onClick={() => setPaginaActual((p) => p + 1)}
          >
            Siguiente
          </button>
          <button
            className="btn btn-outline-success btn-sm"
            onClick={() => cargar(paginaActual)}
          >
            Recargar
          </button>
        </div>
      </section>

      <hr className="border-secondary" />

      <SearchById onResult={setBusquedaPost} />
      {busquedaPost && (
        <div className="mt-2 mb-4">
          <div className="card mt-3 bg-dark text-light border-success-subtle">
            <div className="card-body">
              <h5>{busquedaPost.titulo}</h5>
              <p>{busquedaPost.descripcion || "Sin descripción"}</p>
              <small className="text-muted">
                Publicado por: <strong>{busquedaPost.usuario}</strong>
              </small>
            </div>
          </div>
        </div>
      )}

      <hr className="border-secondary" />

      <CreatePostForm onCreated={() => cargar(paginaActual)} />

      <hr className="border-secondary" />

      <UpdatePostForm
        onUpdated={() => cargar(paginaActual)}
        editingPost={editingPost}
        clearEditing={clearEditing}
      />
    </>
  );
}

// ---------------------- DISCOVER HELPERS ----------------------
function makeShortTitle(text) {
  if (!text) return "Imagen de Unsplash";

  let t = text.replace(/https?:\/\/\S+/g, "").trim();
  t = t.split(/[()\-|•·]/)[0].trim();

  const MAX = 60;
  if (t.length > MAX) t = t.slice(0, MAX - 3).trim() + "...";

  return t || "Imagen de Unsplash";
}

// Convierte DiscoverImage (backend) -> "post" para reutilizar <PostCard />
function unsplashToPost(img) {
  const desc = img.descripcion || "Imagen de Unsplash";
  const tituloCorto = makeShortTitle(desc);

  return {
    id: img.id,
    titulo: tituloCorto,
    fecha_alta: new Date().toISOString(),
    usuario: `${img.autor} (Unsplash)`,
    imagen: img.url_imagen,
    descripcion: desc,
    url: img.url_full,
    tags: ["unsplash"],
    alt: desc,
  };
}

// ---------------------- DISCOVER PAGE ----------------------
function DiscoverPage() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(0);
  const [msg, setMsg] = useState("Cargando imágenes...");
  const [isLoading, setIsLoading] = useState(false);

  const DISCOVER_MAX = 27;
  const DISCOVER_CHUNK = 9;

  async function cargar({ append } = { append: false }) {
    if (isLoading) return;

    if (append && loaded >= DISCOVER_MAX) {
      setMsg("Ya se cargaron todas las imágenes permitidas.");
      return;
    }

    const remaining = DISCOVER_MAX - loaded;
    const count = append
      ? Math.min(DISCOVER_CHUNK, remaining)
      : DISCOVER_CHUNK;

    try {
      setIsLoading(true);
      setMsg("Cargando imágenes de Unsplash...");

      const res = await fetch(`${API}/api/discover?count=${count}`);
      if (!res.ok) {
        setMsg("Error al obtener imágenes de Unsplash.");
        return;
      }

      const data = await res.json();
      const posts = data.map(unsplashToPost);

      setItems((prev) => (append ? [...prev, ...posts] : posts));

      const nuevoTotal = append ? loaded + data.length : data.length;
      setLoaded(nuevoTotal);
      setMsg(`Se han cargado ${nuevoTotal} imágenes (máx ${DISCOVER_MAX}).`);
    } catch (err) {
      console.error(err);
      setMsg("No se pudieron cargar las imágenes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    cargar({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const puedeCargarMas = loaded < DISCOVER_MAX;

  function handleReload() {
    setItems([]);
    setLoaded(0);
    cargar({ append: false });
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h1 className="h4 mb-0">Discover (Unsplash)</h1>

        <button
          id="btnDiscoverReload"
          className="btn btn-sm btn-outline-light"
          onClick={handleReload}
          disabled={isLoading}
        >
          Recargar imágenes
        </button>
      </div>

      <p id="msg-discover" className="text-muted small mb-2">
        {msg}
      </p>

      <section className="mb-3">
        <div id="discover-contenido" className="row g-3">
          {items.map((post) => (
            <PostCard key={post.id} post={post} onEdit={null} onDelete={null} />
          ))}
        </div>
      </section>

      <div className="text-center mt-3 mb-4">
        <button
          id="btnDiscoverLoad"
          className="btn btn-sm btn-outline-light"
          onClick={() => cargar({ append: true })}
          disabled={!puedeCargarMas || isLoading}
        >
          {puedeCargarMas ? "Cargar más" : "No hay más por cargar"}
        </button>
      </div>
    </>
  );
}

// ---------------------- BOTONES FLOTANTES ----------------------
function Switcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDiscover = location.pathname === "/discover";

  const goFeed = () => {
    if (isDiscover) navigate("/");
    else window.location.reload();
  };

  const goDiscover = () => {
    if (isDiscover) window.location.reload();
    else navigate("/discover");
  };

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "16px",
        transform: "translateX(-50%)",
        zIndex: 1000,
      }}
    >
      <div className="btn-group">
        <button onClick={goFeed} className="btn btn-sm btn-light">
          Feed
        </button>
        <button onClick={goDiscover} className="btn btn-sm btn-light">
          Discover
        </button>
      </div>
    </div>
  );
}

function BackToTopButton() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      onClick={scrollTop}
      className="btn btn-success position-fixed bottom-0 end-0 m-4 shadow"
      style={{
        width: "30px",
        height: "30px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      ^
    </button>
  );
}

// ---------------------- APP PRINCIPAL ----------------------
export default function App() {
  return (
    <div className="bg-dark text-light min-vh-100">
      <main className="container py-4">
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
        </Routes>
      </main>

      <Switcher />
      <BackToTopButton />
    </div>
  );
}
