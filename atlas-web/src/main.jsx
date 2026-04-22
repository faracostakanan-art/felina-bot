import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./style.css"

// Activation Telegram WebApp (plein écran)
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp

  tg.ready()
  tg.expand()

  document.body.style.background =
    tg.themeParams?.bg_color || "#0b0b0c"
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
