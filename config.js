// PawSafe Kit — configuración
window.PAWSAFE_CONFIG = {
  // Dirección pública donde se publique el sitio, ej. "https://pawsafe-kit.netlify.app/".
  // Vacío = el QR apunta a found.html junto a la página actual (sirve para probar en tu
  // computadora, pero un celular NO podrá abrirlo). Completar al publicar.
  publicBaseUrl: "https://pawsafekit-app.github.io/pawsafe-kit/",

  // Extras. Cada página extra (carpetas emergency-*, studio-*, family-*) se desbloquea sola en el navegador al abrirla;
  // poner `true` acá los muestra en el kit sin haber abierto la página (útil para pruebas).
  // Es un flag del lado del cliente, no una protección (ver README, "Desbloquear extras").
  features: {
    emergency: false,  // Lost Pet Emergency Pack (order bump)
    studio: false,     // PawSafe Studio (OTO 1)
    familyPack: false  // Family Pack (OTO 2): hasta 5 mascotas extra
  }
};
