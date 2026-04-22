import React, { useEffect, useState } from "react";

const API_URL = "https://felina-backend-production.up.railway.app";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [hiddenContent, setHiddenContent] = useState("");
  const [message, setMessage] = useState("");
  const [products, setProducts] = useState([]);

  const [userIdForBalance, setUserIdForBalance] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");

  const [bulkProductsText, setBulkProductsText] = useState("");

  const loadProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setMessage("Impossible de charger les produits.");
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const addProduct = async () => {
    setMessage("");

    if (!password || !title || !price || !hiddenContent) {
      setMessage("Remplis le mot de passe, le titre, le prix et le contenu privé.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("password", password);
      formData.append("title", title);
      formData.append("subtitle", subtitle);
      formData.append("price", price);
      formData.append("hidden_content", hiddenContent);

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const res = await fetch(`${API_URL}/api/admin/products`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Produit ajouté avec succès.");
        setTitle("");
        setSubtitle("");
        setPrice("");
        setImageFile(null);
        setHiddenContent("");
        await loadProducts();
      } else {
        setMessage(data.error || "Erreur lors de l'ajout.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Erreur de connexion au serveur API.");
    }
  };

  const addProductsBulk = async () => {
    setMessage("");

    if (!password || !bulkProductsText.trim()) {
      setMessage("Remplis le mot de passe et la liste des produits.");
      return;
    }

    const lines = bulkProductsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const productsToAdd = [];

    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());

      if (parts.length < 4) {
        setMessage("Chaque ligne doit contenir : titre | sous-titre | prix | contenu privé");
        return;
      }

      const [bulkTitle, bulkSubtitle, bulkPrice, bulkHiddenContent] = parts;

      if (!bulkTitle || !bulkPrice || !bulkHiddenContent || isNaN(Number(bulkPrice))) {
        setMessage("Une ou plusieurs lignes sont invalides.");
        return;
      }

      productsToAdd.push({
        title: bulkTitle,
        subtitle: bulkSubtitle,
        price: Number(bulkPrice),
        hidden_content: bulkHiddenContent
      });
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/products/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password,
          products: productsToAdd
        })
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`${data.inserted} produit(s) ajoutés avec succès.`);
        setBulkProductsText("");
        await loadProducts();
      } else {
        setMessage(data.error || "Erreur lors de l'ajout en lot.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Erreur de connexion au serveur API.");
    }
  };

  const deleteProduct = async (id) => {
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/api/admin/products/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (data.success) {
        setMessage("Produit supprimé.");
        await loadProducts();
      } else {
        setMessage(data.error || "Erreur lors de la suppression.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Erreur de connexion au serveur API.");
    }
  };

  const addBalance = async () => {
    setMessage("");

    if (!password || !userIdForBalance || !balanceAmount) {
      setMessage("Remplis le mot de passe, l'ID utilisateur et le montant.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/add-balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          password,
          user_id: userIdForBalance,
          amount: parseFloat(balanceAmount)
        })
      });

      const data = await res.json();

      if (data.success) {
        setMessage(`Solde ajouté. Nouveau solde : ${Number(data.user.balance).toFixed(2)}€`);
        setUserIdForBalance("");
        setBalanceAmount("");
      } else {
        setMessage(data.error || "Erreur lors de l'ajout du solde.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Erreur de connexion au serveur API.");
    }
  };

  return (
    <div style={{ padding: "20px", color: "white", background: "#111", minHeight: "100vh" }}>
      <h1>Admin Panel</h1>

      <input
        type="password"
        placeholder="Mot de passe admin"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br /><br />

      <h2>Ajouter un produit</h2>

      <input
        type="text"
        placeholder="Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <br /><br />

      <input
        type="text"
        placeholder="Sous-titre"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
      />
      <br /><br />

      <input
        type="number"
        placeholder="Prix"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <br /><br />

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImageFile(e.target.files[0] || null)}
      />
      <br /><br />

      <textarea
        placeholder="Contenu privé après achat"
        value={hiddenContent}
        onChange={(e) => setHiddenContent(e.target.value)}
        rows={8}
        cols={40}
      />
      <br /><br />

      <button onClick={addProduct}>Ajouter produit</button>

      <hr style={{ margin: "30px 0" }} />

      <h2>Ajouter plusieurs produits d’un coup</h2>

      <textarea
        placeholder={`Produit 1|Sous-titre 1|10.00|contenu privé 1
Produit 2|Sous-titre 2|12.00|contenu privé 2
Produit 3|Sous-titre 3|15.00|contenu privé 3`}
        value={bulkProductsText}
        onChange={(e) => setBulkProductsText(e.target.value)}
        rows={10}
        cols={50}
      />
      <br /><br />

      <button onClick={addProductsBulk}>Ajouter les produits en lot</button>

      <hr style={{ margin: "30px 0" }} />

      <h2>Ajouter du solde à un utilisateur</h2>

      <input
        type="text"
        placeholder="ID utilisateur Telegram"
        value={userIdForBalance}
        onChange={(e) => setUserIdForBalance(e.target.value)}
      />
      <br /><br />

      <input
        type="number"
        placeholder="Montant"
        value={balanceAmount}
        onChange={(e) => setBalanceAmount(e.target.value)}
      />
      <br /><br />

      <button onClick={addBalance}>Ajouter le solde</button>

      <hr style={{ margin: "30px 0" }} />

      <h2>Produits existants</h2>

      {products.map((product) => (
        <div
          key={product.id}
          style={{
            border: "1px solid #333",
            padding: "12px",
            borderRadius: "12px",
            marginBottom: "10px"
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              style={{
                width: "100%",
                maxWidth: "220px",
                borderRadius: "12px",
                marginBottom: "10px",
                display: "block"
              }}
            />
          ) : null}

          <div><strong>{product.title}</strong></div>
          <div>{product.subtitle}</div>
          <div>€{product.price}</div>
          <div>Visible : {product.visible ? "Oui" : "Non"}</div>
          <br />
          <button onClick={() => deleteProduct(product.id)}>Supprimer</button>
        </div>
      ))}

      {!!message && (
        <p style={{ marginTop: "20px", color: "#ffd166" }}>
          {message}
        </p>
      )}
    </div>
  );
}
