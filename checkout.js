// Pays for the bag with Stripe's embedded checkout, right on this page. HQ prices the bag from its
// own product list (never from the browser) and records the order when Stripe confirms payment.
(function () {
  var go = document.querySelector("#checkout-go"),
    error = document.querySelector("#checkout-error"),
    layout = document.querySelector(".checkout-layout"),
    paySection = document.querySelector("#pay-section"),
    checkout = null,
    stripeJs = null;

  function loadStripe() {
    stripeJs = stripeJs || new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = resolve;
      s.onerror = function () { stripeJs = null; reject(new Error("We couldn't load secure checkout. Please check your connection and try again.")); };
      document.head.appendChild(s);
    });
    return stripeJs;
  }

  go.addEventListener("click", function () {
    var items = window.getCart();
    if (!items.length) return;
    go.disabled = true;
    go.textContent = "Opening secure checkout…";
    error.textContent = "";
    fetch(window.HQ_URL + "/api/public/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: items }) })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || "Checkout hit a snag. Please try again.");
          return body;
        });
      })
      .then(function (body) {
        return loadStripe().then(function () {
          var stripe = window.Stripe(body.publishableKey);
          return stripe.initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(body.clientSecret); } });
        });
      })
      .then(function (instance) {
        if (checkout) checkout.destroy();
        checkout = instance;
        layout.hidden = true;
        paySection.hidden = false;
        checkout.mount("#embedded-checkout");
        paySection.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (err) {
        error.textContent = err.message || "Checkout hit a snag. Please try again.";
      })
      .finally(function () {
        go.disabled = false;
        go.textContent = "Continue to payment";
      });
  });

  // Back to the bag: drop this payment session, since the bag may change.
  document.querySelector("#checkout-back").addEventListener("click", function () {
    if (checkout) { checkout.destroy(); checkout = null; }
    paySection.hidden = true;
    layout.hidden = false;
  });
})();
