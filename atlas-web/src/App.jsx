import React, { useEffect, useState } from "react";
import Admin from "./Admin";

const API = "https://felina-backend-production.up.railway.app/api";
const MAX_REFUNDS_PER_DAY = 3;
const REFUND_WINDOW_HOURS = 24;

export default function App() {
  if (window.location.pathname === "/admin") {
    return <Admin />;
  }

  const tg = window.Telegram?.WebApp;
  const telegramUser = tg?.initDataUnsafe?.user;
  const USER_ID = telegramUser?.id ? String(telegramUser.id) : null;

  const [page, setPage] = useState("home");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [balance, setBalance] = useState(0);
  const [cart, setCart] = useState([]);
  const [refundsLeft, setRefundsLeft] = useState(MAX_REFUNDS_PER_DAY);
  const [toast, setToast] = useState(null); // { text, type }
  const [refundingId, setRefundingId] = useState(null);

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  };

  const loadUser = async () => {
    if (!USER_ID) return;
    try {
      const res = await fetch(`${API}/user/${USER_ID}`);
      const data = await res.json();
      if (res.ok) setBalance(Number(data.balance || 0));
    } catch (e) {
      console.error(e);
    }
  };

  const loadRefundStatus = async () => {
    if (!USER_ID) return;
    try {
      const res = await fetch(`${API}/user/${USER_ID}/refund-status`);
      const data = await res.json();
      if (res.ok) setRefundsLeft(Number(data.refunds_left ?? MAX_REFUNDS_PER_DAY));
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch(`${API}/products`);
      const data = await res.json();
      setProducts(res.ok && Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setProducts([]);
    }
  };

  const loadOrders = async () => {
    if (!USER_ID) return;
    try {
      const res = await fetch(`${API}/orders/${USER_ID}`);
      const data = await res.json();
      setOrders(res.ok && Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setOrders([]);
    }
  };

  useEffect(() => {
    if (!USER_ID) {
      showToast("Ouvre la boutique depuis Telegram", "error");
      return;
    }
    loadUser();
    loadProducts();
    loadOrders();
    loadRefundStatus();
  }, [USER_ID]);

  const addToCart = (product) => {
    if (cart.some((i) => i.id === product.id)) {
      showToast("Déjà dans le panier", "error");
      return;
    }
    setCart((prev) => [...prev, product]);
    showToast("Produit ajouté au panier");
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((i) => i.id !== productId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + Number(i.price), 0);

  const checkoutCart = async () => {
    if (cart.length === 0) return showToast("Panier vide", "error");
    if (balance < cartTotal) return showToast("Solde insuffisant", "error");

    try {
      for (const item of cart) {
        const res = await fetch(`${API}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: USER_ID, product_id: item.id }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast(data.error || `Erreur achat ${item.title}`, "error");
          await loadUser();
          await loadProducts();
          await loadOrders();
          return;
        }
        setBalance(Number(data.balance));
      }
      setCart([]);
      await loadProducts();
      await loadOrders();
      setPage("orders");
      showToast("Achat effectué avec succès");
    } catch (e) {
      console.error(e);
      showToast("Erreur lors du paiement", "error");
    }
  };

  const openOrder = async (orderId) => {
    try {
      const res = await fetch(`${API}/orders/${USER_ID}/${orderId}`);
      const data = await res.json();
      if (res.ok) setSelectedOrder(data);
      else showToast(data.error || "Commande introuvable", "error");
    } catch (e) {
      console.error(e);
      showToast("Erreur chargement commande", "error");
    }
  };

  const isRefundable = (order) => {
    if (!order) return false;
    if (order.status === "REFUNDED") return false;
    if (order.status !== "COMPLETED") return false;
    const createdAt = new Date(String(order.created_at).replace(" ", "T") + "Z");
    const hoursDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= REFUND_WINDOW_HOURS;
  };

  const refundOrder = async (order) => {
    if (!order) return;
    const confirmed = window.confirm(
      `Rembourser cette commande ?\n\n` +
      `Ton solde sera recrédité et le produit redeviendra disponible.\n\n` +
      `Remboursements restants aujourd'hui : ${refundsLeft}/${MAX_REFUNDS_PER_DAY}`
    );
    if (!confirmed) return;

    setRefundingId(order.id);
    try {
      const res = await fetch(`${API}/orders/${USER_ID}/${order.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || "Erreur remboursement", "error");
        return;
      }
      setBalance(Number(data.new_balance));
      setRefundsLeft(Number(data.refunds_left ?? refundsLeft - 1));
      showToast(`Remboursement de ${Number(data.refunded_amount).toFixed(2)}€ effectué`);
      await loadOrders();
      await loadProducts();
      // Rafraîchir la commande ouverte
      const refreshed = await fetch(`${API}/orders/${USER_ID}/${order.id}`).then((r) => r.json());
      setSelectedOrder(refreshed);
    } catch (e) {
      console.error(e);
      showToast("Erreur réseau", "error");
    } finally {
      setRefundingId(null);
    }
  };

  const statusClass = (status) => {
    if (status === "REFUNDED") return "refunded";
    if (status === "COMPLETED") return "done";
    return "waiting";
  };

  return (
    <div className="app-shell">
      {toast && (
        <div className={`toast ${toast.type === "error" ? "error" : ""}`} data-testid="toast">
          {toast.text}
        </div>
      )}

      <div className="app-header">
        <div className="app-title">Ma Boutique</div>
        <div className="app-subtitle">
          {telegramUser ? `Bienvenue ${telegramUser.first_name}` : "Interface sécurisée"}
        </div>
      </div>

      {page === "home" && (
        <>
          <div className="balance-card" data-testid="balance-card">
            <div className="balance-label">SOLDE DISPONIBLE</div>
            <div className="balance-amount">€{balance.toFixed(2)}</div>
            <div className="refund-chip" data-testid="refund-chip">
              🔄 {refundsLeft}/{MAX_REFUNDS_PER_DAY} remboursements restants aujourd'hui
            </div>
          </div>

          <button className="filter-btn" onClick={() => { loadUser(); loadProducts(); loadRefundStatus(); }} data-testid="refresh-btn">
            Actualiser
          </button>
          <div className="result-count">{products.length} résultat(s)</div>

          <div className="page-container">
            {products.map((product) => (
              <div className="order-card" key={product.id} data-testid={`product-card-${product.id}`}>
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    style={{
                      width: "100%",
                      borderRadius: "14px",
                      marginBottom: "12px",
                      display: "block",
                      objectFit: "cover",
                      maxHeight: "150px",
                    }}
                  />
                ) : null}

                <div className="order-top">
                  <div>
                    <div className="order-title">{product.title}</div>
                    <div className="order-date">{product.subtitle}</div>
                  </div>
                  <div className="status-badge waiting">DISPONIBLE</div>
                </div>

                <button
                  className="details-btn"
                  onClick={() => addToCart(product)}
                  data-testid={`add-to-cart-${product.id}`}
                >
                  Ajouter au panier (€{Number(product.price).toFixed(2)})
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {page === "cart" && (
        <div className="page-container">
          <h1 className="orders-heading">Panier</h1>

          {cart.length === 0 ? (
            <p>Ton panier est vide.</p>
          ) : (
            <>
              {cart.map((item) => (
                <div className="order-card" key={item.id}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      style={{
                        width: "100%",
                        borderRadius: "14px",
                        marginBottom: "12px",
                        display: "block",
                        objectFit: "cover",
                        maxHeight: "150px",
                      }}
                    />
                  ) : null}

                  <div className="order-top">
                    <div>
                      <div className="order-title">{item.title}</div>
                      <div className="order-date">{item.subtitle}</div>
                    </div>
                    <div className="status-badge waiting">PANIER</div>
                  </div>

                  <div style={{ marginTop: "16px", fontSize: "20px", fontWeight: 800, color: "#c4b5fd" }}>
                    €{Number(item.price).toFixed(2)}
                  </div>

                  <button
                    className="ghost-btn"
                    onClick={() => removeFromCart(item.id)}
                    data-testid={`remove-from-cart-${item.id}`}
                  >
                    Retirer
                  </button>
                </div>
              ))}

              <div className="order-card">
                <div className="order-title" style={{ fontSize: "22px" }}>Total panier</div>
                <div className="order-date">{cart.length} produit(s)</div>
                <div style={{ marginTop: "14px", fontSize: "28px", fontWeight: 800, color: "#c4b5fd" }}>
                  €{cartTotal.toFixed(2)}
                </div>

                <button className="details-btn" onClick={checkoutCart} data-testid="checkout-btn">
                  Payer avec le solde
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {page === "orders" && (
        <div className="page-container">
          <h1 className="orders-heading">Commandes</h1>

          {selectedOrder ? (
            <div className="order-detail-card">
              <div className="order-detail-header">
                <div>
                  <div className="order-detail-title">Commande #{selectedOrder.id}</div>
                  <div className="order-detail-subtitle">{selectedOrder.created_at}</div>
                </div>
                <div className={`order-detail-status ${selectedOrder.status === "REFUNDED" ? "refunded" : ""}`}>
                  {selectedOrder.status}
                </div>
              </div>

              {(selectedOrder.items || []).map((item) => {
                let parsed = null;
                try {
                  parsed = JSON.parse(item.hidden_content || "{}");
                } catch (e) {
                  parsed = null;
                }
                const detailTitle = parsed?.title || item.title;
                const detailPrice = parsed?.monthly_price || `€${Number(item.price).toFixed(2)}`;
                const detailBadges = Array.isArray(parsed?.badges) ? parsed.badges : [];
                const detailFields = Array.isArray(parsed?.fields) ? parsed.fields : [];

                return (
                  <div key={item.id} style={{ marginTop: "18px" }}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={detailTitle}
                        style={{
                          width: "100%",
                          borderRadius: "18px",
                          marginBottom: "16px",
                          display: "block",
                          objectFit: "cover",
                          maxHeight: "170px",
                        }}
                      />
                    ) : null}

                    <div className="product-mini-card">
                      <div className="product-mini-header">
                        <div className="product-mini-header-left">
                          <div className="product-mini-title">{detailTitle}</div>
                          {detailBadges.length > 0 && (
                            <div className="product-mini-badges">
                              {detailBadges.map((b, i) => (
                                <div className="product-mini-badge" key={i}>{b}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="product-mini-price">{detailPrice}</div>
                      </div>

                      {detailFields.length > 0 ? (
                        <div className="product-mini-grid">
                          {detailFields.map((f, i) => (
                            <div className="product-mini-row" key={i}>
                              <div className="product-mini-label">{f?.label || "Champ"}</div>
                              <div className="product-mini-value">{f?.value || "-"}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="order-detail-content-box">
                          <div className="order-detail-content-label">Contenu livré</div>
                          <pre className="order-detail-content-text">{item.hidden_content}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Bouton Remboursement */}
              {isRefundable(selectedOrder) ? (
                <button
                  className="refund-btn"
                  onClick={() => refundOrder(selectedOrder)}
                  disabled={refundingId === selectedOrder.id || refundsLeft <= 0}
                  data-testid="refund-btn"
                >
                  {refundingId === selectedOrder.id
                    ? "Remboursement en cours..."
                    : refundsLeft <= 0
                      ? `Limite atteinte (${MAX_REFUNDS_PER_DAY}/${MAX_REFUNDS_PER_DAY} aujourd'hui)`
                      : `Rembourser cette commande (${refundsLeft}/${MAX_REFUNDS_PER_DAY} restants)`}
                </button>
              ) : selectedOrder.status === "REFUNDED" ? (
                <div style={{ marginTop: "12px", textAlign: "center", color: "#fca5a5", fontSize: "13px", fontWeight: 600 }}>
                  Déjà remboursée{selectedOrder.refunded_at ? ` le ${selectedOrder.refunded_at}` : ""}
                </div>
              ) : (
                <div style={{ marginTop: "12px", textAlign: "center", color: "#9d8fc7", fontSize: "13px" }}>
                  Délai de remboursement dépassé (24h max)
                </div>
              )}

              <button className="ghost-btn" onClick={() => setSelectedOrder(null)} data-testid="back-to-orders">
                Retour
              </button>
            </div>
          ) : (
            (orders || []).map((order) => (
              <div className="order-card" key={order.id} data-testid={`order-card-${order.id}`}>
                <div className="order-top">
                  <div>
                    <div className="order-title">Commande #{order.id}</div>
                    <div className="order-date">{order.created_at}</div>
                  </div>
                  <div className={`status-badge ${statusClass(order.status)}`}>{order.status}</div>
                </div>

                <button className="details-btn" onClick={() => openOrder(order.id)} data-testid={`view-order-${order.id}`}>
                  Voir les détails
                </button>
              </div>
            ))
          )}

          {orders.length === 0 && !selectedOrder && <p>Aucune commande.</p>}
        </div>
      )}

      <div className="bottom-nav">
        <div
          className={page === "home" ? "nav-item active-nav" : "nav-item"}
          onClick={() => { setPage("home"); setSelectedOrder(null); }}
          data-testid="nav-home"
        >
          <div className="nav-icon">⌂</div>
          <div className="nav-text">Accueil</div>
        </div>

        <div
          className={page === "cart" ? "nav-item active-nav" : "nav-item"}
          onClick={() => { setPage("cart"); setSelectedOrder(null); }}
          data-testid="nav-cart"
        >
          <div className="nav-icon">🛒</div>
          <div className="nav-text">Panier ({cart.length})</div>
        </div>

        <div
          className={page === "orders" ? "nav-item active-nav" : "nav-item"}
          onClick={() => setPage("orders")}
          data-testid="nav-orders"
        >
          <div className="nav-icon">⬡</div>
          <div className="nav-text">Commandes</div>
        </div>
      </div>
    </div>
  );
}
