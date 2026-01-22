from flask import Flask, render_template, request, session, jsonify
from flask_mysqldb import MySQL
import json

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'your_secret_key'

# --- MySQL Configuration ---
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = ''
app.config['MYSQL_DB'] = 'bs_cafe'
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'

db = MySQL(app)

# -------------------------------
#            ROUTES
# -------------------------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/menu')
def menu():
    cur = db.connection.cursor()
    cur.execute("SELECT item_id, name, price, image_url FROM MenuItems")
    items = cur.fetchall()
    cur.close()
    return render_template('dropdowns/menu.html', items=items)

@app.route('/checkout')
def checkout_page():
    selected_location = session.get('location', '')
    return render_template('checkout/index.html', selected_location=selected_location)

#no database needed
@app.route('/promotions')
def promotions():
    return render_template('carousel/rewards.html')

@app.route('/events')
def events():
    return render_template('carousel/events.html')

@app.route('/about')
def about():
    return render_template('about/index.html')

@app.route('/location')
def location_page():
    return render_template('location/index.html')

# -------------------------------
#     CART & ORDER FUNCTIONS
# -------------------------------
@app.route('/add_to_cart', methods=['POST'])
def add_to_cart():
    data = request.get_json()
    item_id = str(data['item_id'])
    quantity = int(data.get('quantity', 1))

    cart = session.get('cart', {})

    # Prevent direct addition of promo muffin
    if item_id == "promo_muffin":
        return jsonify(get_cart_details())

    cart[item_id] = cart.get(item_id, 0) + quantity
    session['cart'] = cart

    # Re-evaluate promo: clear promo_removed if cart qualifies for free muffin
    muffin_id = "2"
    total_items = sum(q for k,q in cart.items())
    muffin_count = cart.get(muffin_id, 0)
    qualifies_for_free = (
        total_items > 0 and (muffin_count == 0 or muffin_count >= 2 or (muffin_count == 1 and total_items > 1))
    )
    if qualifies_for_free:
        session.pop('promo_removed', None)

    return jsonify(get_cart_details())


@app.route('/remove_from_cart', methods=['POST'])
def remove_from_cart():
    data = request.get_json()
    item_id = str(data.get("item_id"))
    amount = int(data.get("amount", 1))

    cart = session.get("cart", {})

    if item_id == "promo_muffin":
        # User explicitly removed the free muffin
        session["promo_removed"] = True
    else:
        # Remove real item
        if item_id in cart:
            cart[item_id] -= amount
            if cart[item_id] <= 0:
                del cart[item_id]

        session["cart"] = cart

        # Re-evaluate promo: clear promo_removed if cart qualifies for free muffin
        muffin_id = "2"
        total_items = sum(q for k,q in cart.items())
        muffin_count = cart.get(muffin_id, 0)
        qualifies_for_free = (
            total_items > 0 and (muffin_count == 0 or muffin_count >= 2 or (muffin_count == 1 and total_items > 1))
        )
        if qualifies_for_free:
            session.pop("promo_removed", None)

    session["cart"] = cart
    return jsonify(get_cart_details())


@app.route('/cart_data')
def cart_data():
    cart_dict = get_cart_details()
    # return jsonify(cart_dict)
    return jsonify(list(cart_dict.values()))

@app.route('/checkout', methods=['POST'])
def checkout():
    data = request.get_json()
    print("Payload received:", json.dumps(data, indent=2))

    # Correct Keys
    location_id = data.get('location_id')
    cart = data.get('cart')
    billing = data.get('billing')
    payment = data.get('payment')

    if not location_id or not cart or not billing or not payment:
        return jsonify({'error': 'Missing required checkout data!'}), 400

    # Use real user
    user_id = session.get('user_id', 1515)

    # Calculate total from price_each
    order_total = sum(float(item['price_each']) * int(item['quantity']) for item in cart)

    cur = db.connection.cursor()

    try:
        # Insert Order
        cur.execute(
            "INSERT INTO Orders (user_id, location_id, order_total) VALUES (%s, %s, %s)",
            (user_id, location_id, order_total)
        )
        db.connection.commit()
        order_id = cur.lastrowid

        # Insert Order Items
        for item in cart:
            cur.execute(
                "INSERT INTO OrderItems (order_id, item_id, quantity, price_each) VALUES (%s, %s, %s, %s)",
                (order_id, item['item_id'], item['quantity'], item['price_each'])
            )

        # Insert Payment Record
        cur.execute(
            "INSERT INTO payment_info (order_id, location_id, payment_method, card_name, card_last4, expiration_date) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (
                order_id,
                location_id,
                payment['payment_method'],
                payment['card_name'],
                payment['card_last4'],
                payment['expiration_date']
            )
        )

        db.connection.commit()
        session['cart'] = {}  # clear cart

    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()

    return jsonify({'order_id': order_id})





@app.route('/process_checkout', methods=['POST'])
def process_checkout():
    data = request.get_json()
    user_id = 1515
    location_id = data.get('location')
    cart = session.get('cart', {})

    if not user_id or not location_id or not cart:
        return jsonify({'error': 'Missing data or empty cart!'})

    order_total = 0
    for item_id, qty in cart.items():
        cur = db.connection.cursor()
        cur.execute("SELECT price FROM MenuItems WHERE item_id=%s", (item_id,))
        item = cur.fetchone()
        if item:
            order_total += item['price'] * qty
        cur.close()

    # Insert into Orders
    cur = db.connection.cursor()
    cur.execute(
        "INSERT INTO Orders (user_id, location_id, order_total) VALUES (%s, %s, %s)",
        (user_id, location_id, order_total)
    )
    db.connection.commit()
    order_id = cur.lastrowid

    # Insert each item into OrderItems
    for item_id, qty in cart.items():
        cur.execute(
            "SELECT price FROM MenuItems WHERE item_id=%s",
            (item_id,)
        )
        item = cur.fetchone()
        if item:
            cur.execute(
                "INSERT INTO OrderItems (order_id, item_id, quantity, price) VALUES (%s, %s, %s, %s)",
                (order_id, item_id, qty, item['price'])
            )
    db.connection.commit()
    cur.close()

    session['cart'] = {}  # clear cart
    return jsonify({'order_id': order_id})


@app.route('/set_location', methods=['POST'])
def set_location():
    data = request.get_json()
    session['location'] = data.get('location')
    return jsonify({"success": True})

# -------------------------------
#       HELPER FUNCTIONS
# -------------------------------
def get_cart_details():
    cart = session.get("cart", {}) or {}
    result = {}

    muffin_id = "2"
    promo_id = "promo_muffin"
    drink_ids = {"5", "6", "7", "8", "9", "10", "11"}

    if not cart:
        return {}

    # --- Load all menu items ---
    cur = db.connection.cursor()
    cur.execute("SELECT item_id, name, price FROM MenuItems")
    rows = cur.fetchall()
    cur.close()

    products = {str(r["item_id"]): {"name": r["name"], "price": float(r["price"])} for r in rows}

    # --- Add real cart items ---
    for item_id, qty in cart.items():
        if item_id not in products:
            continue
        result[item_id] = {
            "item_id": item_id,
            "name": products[item_id]["name"],
            "quantity": int(qty),
            "price": float(products[item_id]["price"]),
        }

    # --- Determine if user qualifies for free muffin ---
    promo_removed = session.get("promo_removed", False)
    total_items = sum(q for k, q in cart.items())
    muffin_count = cart.get(muffin_id, 0)
    qualifies_for_free = (total_items > 0 and (muffin_count == 0 or muffin_count >= 2 or (muffin_count == 1 and total_items > 1)))

    if qualifies_for_free and not promo_removed:
        # Adjust real muffin quantity if needed
        if muffin_count >= 2:
            result[muffin_id]["quantity"] = muffin_count - 1
            free_qty = 1
        elif muffin_count == 1 and total_items > 1:
            result.pop(muffin_id, None)
            free_qty = 1
        elif muffin_count == 0:
            free_qty = 1

        # Add virtual promo muffin
        result[promo_id] = {
            "item_id": muffin_id,
            "name": "Free Muffin",
            "quantity": free_qty,
            "price": 0.00,
        }

    # --- Drink discount ---
    drink_items = {k: v for k, v in result.items() if k in drink_ids}
    subtotal = sum(v["price"] * v["quantity"] for v in result.values())

    if subtotal > 10 and drink_items:
        # Pick the most expensive drink BEFORE discount
        drink_key = max(drink_items.keys(), key=lambda k: drink_items[k]["price"])
        drink = drink_items[drink_key]

        original_price = drink["price"]
        discounted_price = round(original_price * 0.5, 2)

        # Only apply the discount if the final total remains above 10 after discount
        if (subtotal - (original_price - discounted_price)) > 10:
            result[drink_key]["price"] = discounted_price
            result[drink_key]["discount_applied"] = True
            result[drink_key]["discount_type"] = "-50%"


    return result


if __name__ == '__main__':
    app.run(debug=True)
