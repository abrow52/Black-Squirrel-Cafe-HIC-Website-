(() => {
    'use strict';

    
    

    function updateCartUI(cartData) {
        let safeCart = Array.isArray(cartData) ? cartData : Object.values(cartData);

        // -----------------------------
        //   PROMO DETECTION
        // -----------------------------

        // Free muffin promo item (backend returns this with price=0)
        const muffinPromoInCart = safeCart.some(
            item => item.name === "Free Muffin" && item.price === 0
        );

        // Drink promo applied (any drink with discount_applied: true)
        const drinkPromoInCart = safeCart.some(
            item => item.discount_applied === true && item.discount_type === "-50%"
        );

        // -----------------------------
        //   PROMO BOXES UI
        // -----------------------------
        const muffinPromoBox = document.getElementById("promo-muffin");
        const drinkPromoBox  = document.getElementById("promo-drink");

        if (muffinPromoBox) {
            muffinPromoBox.classList.toggle("applied", muffinPromoInCart);
            // muffinPromoBox.classList.toggle("d-none", !muffinPromoInCart);
        }
        
        if (drinkPromoBox) {
            drinkPromoBox.classList.toggle("applied", drinkPromoInCart);
            // drinkPromoBox.classList.toggle("d-none", !drinkPromoInCart);
        }

        // -----------------------------
        //   CART CALCULATIONS
        // -----------------------------
        let totalQuantity = 0;
        let cartTotal = 0;

        safeCart.forEach(item => {
            item.quantity = Number(item.quantity) || 0;
            item.price = Number(item.price) || 0;

            totalQuantity += item.quantity;
            cartTotal += item.price * item.quantity;
        });

        // -----------------------------
        //   NAVBAR CART DROPDOWN
        // -----------------------------
        const navbarCount = document.getElementById('navbar-cart-count');
        const navbarTotal = document.getElementById('navbar-cart-total');
        const dropdownItemsContainer = document.getElementById('cart-items-dropdown');

        if (navbarCount) navbarCount.innerText = totalQuantity;
        if (navbarTotal) navbarTotal.innerText = `$${cartTotal.toFixed(2)}`;

        if (navbarCount) navbarCount.innerText = totalQuantity;

        if (dropdownItemsContainer) {
            dropdownItemsContainer.innerHTML = '';

            if (!safeCart.length) {
                dropdownItemsContainer.innerHTML =
                    `<p class="text-center text-muted mb-0">Your cart is empty</p>`;
            } else {
                safeCart.forEach(item => {
                    const div = document.createElement('div');
                    div.className = "d-flex justify-content-between align-items-center mb-2";

                    const isPromoMuffin = item.name === "Free Muffin" && item.price === 0;
                    const removeId = isPromoMuffin ? "promo_muffin" : item.item_id;

                    div.innerHTML = `
                        <div class="d-flex flex-column">
                            <span class="fw-semibold">${item.name}</span>
                            <small class="text-muted">Qty: ${item.quantity}</small>
                        </div>

                        <div class="d-flex align-items-center">
                        <span class="me-3">
                            $${(item.price * item.quantity).toFixed(2)}
                            ${item.discount_applied ? `<span class="text-danger fw-bold ms-1">(${item.discount_type})</span>` : ""}
                        </span>
                    
                            <button class="btn btn-sm btn-danger remove-dropdown-item" data-id="${removeId}">&times;</button>
                        </div>
                    `;


                    dropdownItemsContainer.appendChild(div);
                });

                dropdownItemsContainer.querySelectorAll(".remove-dropdown-item")
                    .forEach(btn => btn.addEventListener("click", () => removeFromCart(btn.dataset.id)));
            }
        }

        // -----------------------------
        //   CHECKOUT PAGE LIST
        // -----------------------------
        const cartList = document.getElementById('cart-items');
        const cartCountEl = document.getElementById('cart-count');
        const cartTotalEl = document.getElementById('cart-total'); 

        if (cartList) {
            cartList.innerHTML = '';

            if (!safeCart.length){
                cartList.innerHTML = `
                    <li class="list-group-item text-center text-muted">
                        Your cart is empty
                    </li>
                `;
            } else {
                safeCart.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between lh-sm';
    
                    const isPromoMuffin = item.name === "Free Muffin" && item.price === 0;
                    const removeId = isPromoMuffin ? "promo_muffin" : item.item_id;
    
                    li.innerHTML = `
                        <div>
                            <h6 class="my-0">${item.name}</h6>
                            <small class="text-muted">Quantity: ${item.quantity}</small>
                        </div>
    
                        <div class="d-flex align-items-center">
                            <span class="me-3">
                                $${(item.price * item.quantity).toFixed(2)}
                                ${item.discount_applied ? `<span class="text-danger fw-bold ms-1">(${item.discount_type})</span>` : ""}
                            </span>
    
                            <button class="btn btn-sm btn-outline-danger remove-cart-item" data-id="${removeId}">
                                x
                            </button>
                        </div>
                    `;
    
    
                    cartList.appendChild(li);
                });
    
                cartList.querySelectorAll(".remove-cart-item")
                .forEach(btn =>
                    btn.addEventListener("click", () => removeFromCart(btn.dataset.id))
                );
            }

            if (cartTotalEl) {
                cartTotalEl.innerText = `$${cartTotal.toFixed(2)}`;
            }

            if (cartCountEl) cartCountEl.innerText = totalQuantity;
        }

        document.dispatchEvent(new Event("cart-updated"));

    }

    // -----------------------------
    //   ADD / REMOVE FUNCTIONS
    // -----------------------------
    window.addToCart = function (itemId) {
        fetch('/add_to_cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: itemId })
        })
            .then(res => res.json())
            // .then(cartData => updateCartUI(cartData), showAddedToast());
            .then(cartData => updateCartUI(cartData), showRemovedPopup("Added to cart"))
    };

    window.removeFromCart = function (itemId) {
        fetch('/remove_from_cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: itemId, amount: 1 })
        })
            .then(res => res.json())
            .then(cartData => updateCartUI(cartData), showRemovedPopup("Removed from cart"))
            .catch(err => console.error("Remove error:", err));
    };

    // function showAddedToast() {
    //     const toastEl = document.getElementById('cart-toast');
    //     if (toastEl) {
    //         const toast = new bootstrap.Toast(toastEl);
    //         toast.show();
    //     }
    // }

    function showRemovedPopup(message) {
        const popup = document.createElement("div");
        popup.className = "cart-popup";
        popup.innerText = message;
        document.body.appendChild(popup);

        setTimeout(() => popup.classList.add("show"), 10);
        setTimeout(() => {
            popup.classList.remove("show");
            setTimeout(() => popup.remove(), 300);
        }, 2000);
    }


    // -----------------------------
    //   INITIAL CART LOAD
    // -----------------------------
    document.addEventListener('DOMContentLoaded', () => {
        fetch('/cart_data')
            .then(res => res.json())
            .then(cartData => updateCartUI(cartData));
    });
    

})();


