(() => {
    'use strict';

    // Bootstrap form validation
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });

    document.addEventListener("DOMContentLoaded", () => {
        const savedLoc = sessionStorage.getItem("selectedLocation");
        const savedType = sessionStorage.getItem("selectedType");

        if (savedLoc) {
            const dropdown = document.getElementById("location");
            if (dropdown) dropdown.value = savedLoc;
        }

        if (savedType) {
            const dropdown = document.getElementById("pickup-type");
            if (dropdown) dropdown.value = savedType;
        }

        const form = document.getElementById("checkout-form");
        if (!form) return;

        const confirmModalEl = document.getElementById("confirmOrderModal");
        const confirmModal = new bootstrap.Modal(confirmModalEl);
        const orderPlacedModalEl = document.getElementById("orderPlacedModal");
        const orderPlacedModal = new bootstrap.Modal(orderPlacedModalEl);
        const confirmBtn = document.getElementById("confirmOrderBtn");

        let formData = null; // store data to use on confirm

        form.addEventListener("submit", async function(e) {
            e.preventDefault();

            if (!form.checkValidity()) {
                form.classList.add("was-validated");
                return;
            }

            const locationId = parseInt(document.getElementById("location").value);
            const pickupType = document.getElementById("pickup-type").value;
            if (!locationId) {
                alert("Please select a location!");
                return;
            }

            // Save data for confirm handler
            formData = { locationId, pickupType };

            // Show confirm modal
            confirmModal.show();
        });

        const locationWaitTimes = {
            101: 8, // Library
            102: 3,  // Main Street
            103: 2  // Acorn Alley
        };

        confirmBtn.addEventListener("click", async () => {
            confirmModal.hide();

            // Use saved locationId
            const locationId = formData.locationId;

            const cart = await fetch('/cart_data').then(res => res.json());
            if (!cart.length) {
                alert("Your cart is empty!");
                return;
            }

            const cartItems = cart.map(item => ({
                item_id: parseInt(item.item_id),
                quantity: parseInt(item.quantity),
                price_each: parseFloat(item.price)
            }));

            const billing = {
                first_name: document.getElementById("firstName").value.trim(),
                last_name: document.getElementById("lastName").value.trim(),
                email: document.getElementById("email").value.trim(),
                address: document.getElementById("address").value.trim(),
                city: document.getElementById("city").value.trim(),
                state: document.getElementById("state").value.trim(),
                zip_code: document.getElementById("zip").value.trim()
            };

            const payment = {
                payment_method: document.querySelector('input[name="paymentMethod"]:checked').value,
                card_name: document.getElementById("cc-name").value.trim(),
                card_last4: document.getElementById("cc-number").value.trim().slice(-4),
                expiration_date: document.getElementById("cc-expiration").value.trim()
            };

            const payload = { location_id: locationId, cart: cartItems, billing, payment, user_id: 1515 };

            try {
                const response = await fetch("/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    alert("Error: " + (errData.error || "Unknown error"));
                    return;
                }

                const data = await response.json();
                const email = billing.email;

                // Wait time logic
                const waitMinutes = locationWaitTimes[locationId] || 10;
                const readyTime = new Date(Date.now() + waitMinutes * 60000);

                const formattedTime = readyTime.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit"
                });

                document.getElementById("orderModalText").innerHTML =
                    `
                    <strong>Order placed!</strong><br>
                    Order number: ${data.order_id}<br><br>
                    Your order will be ready around <strong>${formattedTime}</strong>.<br>
                    A confirmation email has been sent to <strong>${email} along with order details</strong>.
                    `;

                orderPlacedModal.show();

                // document.getElementById("orderModalText").innerText = `Order placed! Order ID: ${data.order_id}`;
                // orderPlacedModal.show();

                orderPlacedModalEl.addEventListener('hidden.bs.modal', () => { 
                    window.location.href = "/";
                });

            } catch (err) {
                console.error("Checkout error:", err);
                alert("An error occurred while submitting your order.");
            }
        });

        const driveThruAllowed = {
            101: false, // Library
            102: true,  // Main Street (drive-thru allowed)
            103: false  // Acorn Alley
        };

        const locationDropdown = document.getElementById("location");
        const typeDropdown = document.getElementById("pickup-type");

        function updatePickupOptions() {
            if (!locationDropdown || !typeDropdown) return;

            const selectedLocation = locationDropdown.value;

            Array.from(typeDropdown.options).forEach(option => {
                if (option.value === "drive-thru") {
                    option.style.display = driveThruAllowed[selectedLocation] ? '' : 'none';
                    if (!driveThruAllowed[selectedLocation] && option.selected) {
                        // Switch to pickup if drive-thru was selected but now hidden
                        typeDropdown.value = "in-store";
                    }
                }
            });
        }

        // Run initially and whenever location changes
        updatePickupOptions();
        locationDropdown.addEventListener("change", updatePickupOptions);
        
    });
})();
