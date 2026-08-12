#!/usr/bin/env python3
"""Populate Herbal Hub's MongoDB database with realistic, repeatable demo data."""

import asyncio
import random
import secrets
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env", override=True)

from app.config import settings  # noqa: E402
from app.services.financial_crypto import encrypt_sensitive  # noqa: E402
from app.services.postal_shipping_service import calculate_parcel_weight, calculate_shipping_fee  # noqa: E402
from app.utils.helpers import hash_password  # noqa: E402

SEED = {"seed_data": True}
NOW = datetime.now(UTC)
RNG = random.Random(20260721)

CATEGORIES = [
    "Ayurvedic", "Unani", "Siddha", "Homeopathic", "Herbal Supplements",
    "Herbal Skincare", "Herbal Haircare", "Herbal Food & Beverages",
    "Essential Oils", "Herbal First Aid",
]

PRODUCTS = [
    ("Ashwagandha Vitality Capsules", "Herbal Supplements", "Supports energy, resilience and restful sleep."),
    ("Ceylon Cinnamon Capsules", "Herbal Supplements", "Pure Ceylon cinnamon for everyday metabolic wellness."),
    ("Organic Turmeric Curcumin", "Ayurvedic", "Turmeric and black pepper blend for joint comfort."),
    ("Triphala Digestive Tablets", "Ayurvedic", "Traditional three-fruit digestive support."),
    ("Brahmi Memory Tonic", "Ayurvedic", "Herbal tonic traditionally used for concentration."),
    ("Neem Purifying Capsules", "Ayurvedic", "Traditional botanical support for clear skin."),
    ("Moringa Leaf Powder", "Herbal Food & Beverages", "Nutrient-rich Sri Lankan moringa leaf powder."),
    ("Gotu Kola Herbal Tea", "Herbal Food & Beverages", "Refreshing gotu kola infusion for daily wellbeing."),
    ("Belimal Herbal Drink", "Herbal Food & Beverages", "Fragrant bael flower drink enjoyed across Sri Lanka."),
    ("Ranawara Flower Tea", "Herbal Food & Beverages", "Naturally caffeine-free golden herbal tea."),
    ("Iramusu Cooling Drink", "Herbal Food & Beverages", "Traditional sarsaparilla root infusion."),
    ("Polpala Herbal Tea", "Herbal Food & Beverages", "Traditional Sri Lankan herbal wellness tea."),
    ("Ginger Coriander Tea", "Herbal Food & Beverages", "Warming ginger and coriander seed blend."),
    ("Nelli Amla Juice", "Herbal Food & Beverages", "Vitamin-C-rich Indian gooseberry juice."),
    ("Kothala Himbutu Tea", "Ayurvedic", "Traditional woody-vine herbal infusion."),
    ("Paspanguwa Wellness Pack", "Ayurvedic", "Classic five-herb decoction blend."),
    ("Sandalwood Face Pack", "Herbal Skincare", "Cooling sandalwood and clay facial treatment."),
    ("Neem & Turmeric Face Wash", "Herbal Skincare", "Gentle botanical cleanser for daily use."),
    ("Aloe Vera Soothing Gel", "Herbal Skincare", "Cooling aloe gel for face and body."),
    ("Kumkumadi Facial Oil", "Herbal Skincare", "Traditional saffron facial oil for evening care."),
    ("Herbal Rose Water", "Herbal Skincare", "Steam-distilled rose facial mist."),
    ("Calendula Healing Balm", "Herbal First Aid", "Comforting balm for dry, rough skin."),
    ("Tea Tree Spot Gel", "Herbal Skincare", "Targeted tea tree botanical gel."),
    ("Herbal Lip Balm", "Herbal Skincare", "Beeswax, coconut and cocoa butter lip care."),
    ("Bhringraj Hair Oil", "Herbal Haircare", "Traditional scalp and hair-conditioning oil."),
    ("Amla Hair Growth Oil", "Herbal Haircare", "Amla-infused coconut oil for strong-looking hair."),
    ("Hibiscus Herbal Shampoo", "Herbal Haircare", "Gentle hibiscus and fenugreek hair cleanser."),
    ("Fenugreek Hair Mask", "Herbal Haircare", "Rich botanical conditioning treatment."),
    ("Curry Leaf Hair Tonic", "Herbal Haircare", "Lightweight curry leaf scalp tonic."),
    ("Herbal Anti-Dandruff Oil", "Herbal Haircare", "Neem and tea tree scalp-care blend."),
    ("Ceylon Lemongrass Oil", "Essential Oils", "Bright, steam-distilled lemongrass essential oil."),
    ("Cinnamon Leaf Essential Oil", "Essential Oils", "Warm Ceylon cinnamon leaf aroma."),
    ("Citronella Essential Oil", "Essential Oils", "Fresh Sri Lankan citronella essential oil."),
    ("Eucalyptus Essential Oil", "Essential Oils", "Crisp eucalyptus oil for diffuser use."),
    ("Peppermint Essential Oil", "Essential Oils", "Cooling peppermint aromatic oil."),
    ("Lavender Essential Oil", "Essential Oils", "Relaxing lavender aroma for evening routines."),
    ("Clove Bud Essential Oil", "Essential Oils", "Rich and warming clove bud oil."),
    ("Herbal Muscle Relief Oil", "Herbal First Aid", "Warming massage blend for tired muscles."),
    ("Siddha Joint Comfort Balm", "Siddha", "Traditional herbal balm for massage."),
    ("Siddha Digestive Powder", "Siddha", "Aromatic traditional digestive herbal powder."),
    ("Unani Herbal Cough Syrup", "Unani", "Honey-based herbal throat comfort syrup."),
    ("Unani Liver Tonic", "Unani", "Traditional botanical wellness tonic."),
    ("Arnica Comfort Gel", "Homeopathic", "Cooling topical arnica gel for massage."),
    ("Homeopathic Cold Relief", "Homeopathic", "Convenient homeopathic wellness tablets."),
    ("Herbal Immunity Syrup", "Herbal Supplements", "Tulsi, ginger and amla daily syrup."),
    ("Tulsi Holy Basil Capsules", "Herbal Supplements", "Holy basil capsules for daily balance."),
    ("Spirulina Green Tablets", "Herbal Supplements", "Plant-based green nutrition tablets."),
    ("Herbal Sleep Support", "Herbal Supplements", "Valerian, passionflower and ashwagandha blend."),
    ("Natural Mosquito Balm", "Herbal First Aid", "Citronella and lemongrass outdoor balm."),
    ("Herbal Vapour Rub", "Herbal First Aid", "Eucalyptus and menthol aromatic chest rub."),
]


def money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def upsert_user(db, *, name, email, phone, password, role):
    existing = await db.users.find_one({"email": email})
    if existing and existing.get("phone"):
        phone = existing["phone"]
    else:
        candidate = phone
        suffix = 0
        while await db.users.find_one({"phone": candidate, "email": {"$ne": email}}):
            suffix += 1
            candidate = f"+9477999{int(phone[-4:]) + suffix:04d}"
        phone = candidate
    doc = {
        "name": name, "email": email, "phone": phone, "password": hash_password(password),
        "role": role, "is_active": True, "email_verified": True, "address": {
            "address_line1": "42 Green Lane", "city": "Colombo", "state": "Western",
            "pincode": "00700", "country": "Sri Lanka",
        }, "profile_image": None, "updated_at": NOW, **SEED,
    }
    await db.users.update_one({"email": email}, {"$set": doc, "$setOnInsert": {"created_at": NOW}}, upsert=True)
    return await db.users.find_one({"email": email})


async def seed():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DB_NAME]
    try:
        await db.command("ping")
        print(f"Connected to MongoDB database: {settings.DB_NAME}")

        users = {}
        specs = [
            ("admin", "Herbal Hub Administrator", settings.ADMIN_EMAIL, "+94770000001", settings.ADMIN_PASSWORD, "admin"),
            ("customer", "Nimali Perera", "demo@herbalhub.in", "+94770000002", secrets.token_urlsafe(24), "customer"),
            ("seller1", "Kasun Ayurveda", "seller@herbalhub.in", "+94770000003", secrets.token_urlsafe(24), "seller"),
            ("seller2", "Amaya Naturals", "seller2@herbalhub.in", "+94770000004", secrets.token_urlsafe(24), "seller"),
            ("seller3", "Ceylon Herbal Care", "seller3@herbalhub.in", "+94770000005", secrets.token_urlsafe(24), "seller"),
            ("delivery", "Ruwan Silva", "delivery@herbalhub.in", "+94770000006", secrets.token_urlsafe(24), "delivery_partner"),
        ]
        for key, name, email, phone, password, role in specs:
            users[key] = await upsert_user(db, name=name, email=email, phone=phone, password=password, role=role)
        print("Seeded 1 admin, 1 customer, 3 sellers and 1 delivery partner")

        # Replace only seed-owned marketplace documents so reruns are deterministic.
        collections = ["categories", "seller_bank_accounts", "sellers", "reviews", "deliveries",
                       "notifications", "payout_attempts", "payouts", "payments",
                       "seller_order_allocations", "financial_orders", "orders", "medicines"]
        for collection in collections:
            await db[collection].delete_many(SEED)

        await db.categories.insert_many([{
            "name": category, "slug": category.lower().replace(" & ", "-").replace(" ", "-"),
            "description": f"Browse {category.lower()} products.", "is_active": True,
            "sort_order": index, "created_at": NOW, **SEED,
        } for index, category in enumerate(CATEGORIES, 1)])

        sellers = []
        seller_details = [
            ("seller1", "Kasun Ayurveda Store", "Bank of Ceylon", "Borella", "001234567890"),
            ("seller2", "Amaya Naturals", "Commercial Bank", "Kandy City", "002345678901"),
            ("seller3", "Ceylon Herbal Care", "Sampath Bank", "Galle Fort", "003456789012"),
        ]
        for number, (key, business, bank, branch, account) in enumerate(seller_details, 1):
            user = users[key]
            seller_doc = {
                "user_id": str(user["_id"]), "name": user["name"], "email": user["email"],
                "phone": user["phone"], "nic_encrypted": encrypt_sensitive(f"19901234567{number}"),
                "business_name": business, "approval_status": "APPROVED",
                "created_at": NOW - timedelta(days=180 - number * 10), "updated_at": NOW, **SEED,
            }
            seller_result = await db.sellers.insert_one(seller_doc)
            seller_doc["_id"] = seller_result.inserted_id
            sellers.append(seller_doc)
            await db.seller_bank_accounts.insert_one({
                "seller_id": str(seller_result.inserted_id), "bank_name": bank, "branch": branch,
                "account_holder_name": user["name"], "account_number_encrypted": encrypt_sensitive(account),
                "account_number_last4": account[-4:], "verified": True,
                "created_at": seller_doc["created_at"], "updated_at": NOW, **SEED,
            })
        print("Seeded 3 approved seller financial profiles and bank accounts")

        medicines = []
        manufacturers = [seller["business_name"] for seller in sellers]
        for index, (name, category, description) in enumerate(PRODUCTS):
            seller_index = index % 3
            base_price = 280 + (index % 10) * 95 + (index // 10) * 40
            discount = base_price - (50 + index % 4 * 20) if index % 3 != 0 else None
            doc = {
                "name": name, "description": description, "category": category,
                "price": float(base_price), "discount_price": float(discount) if discount else None,
                "weight_grams": 75 + (index % 6) * 25,
                "stock": 20 + (index * 13) % 180, "requires_prescription": index in {40, 41, 43},
                "manufacturer": manufacturers[seller_index], "seller_id": str(users[f"seller{seller_index + 1}"]["_id"]),
                "seller_name": manufacturers[seller_index], "ingredients": name.split()[:3],
                "dosage": "Use as directed on the label or by your healthcare professional.",
                "benefits": ["Traditional herbal wellness", "Quality checked", "Locally supplied"],
                "side_effects": ["Stop use if irritation occurs"],
                "images": [f"https://picsum.photos/seed/herbal-{index + 1}/700/700"],
                "tags": list({category.lower(), *[part.lower() for part in name.split()[:3]]}),
                "average_rating": round(4.0 + (index % 10) * 0.1, 1), "review_count": 0,
                "is_active": True, "created_at": NOW - timedelta(days=120 - index), "updated_at": NOW, **SEED,
            }
            result = await db.medicines.insert_one(doc)
            doc["_id"] = result.inserted_id
            medicines.append(doc)
        print("Seeded 10 categories and 50 herbal medicines")

        order_docs, completed_orders = [], []
        statuses = ["delivered"] * 10 + ["placed", "confirmed", "packed", "placed", "confirmed"]
        for order_index, status in enumerate(statuses):
            selected = [medicines[(order_index * 3) % 50], medicines[(order_index * 3 + 1) % 50]]
            items = []
            for item_index, med in enumerate(selected):
                quantity = 1 + ((order_index + item_index) % 2)
                price = med.get("discount_price") or med["price"]
                items.append({"medicine_id": str(med["_id"]), "name": med["name"], "price": price,
                              "quantity": quantity, "image": med["images"][0],
                              "weight_grams": med["weight_grams"],
                              "requires_prescription": med["requires_prescription"]})
            subtotal = money(sum(Decimal(str(item["price"])) * item["quantity"] for item in items))
            parcel_weight = calculate_parcel_weight(items)
            shipping_fee = calculate_shipping_fee(parcel_weight)
            final = money(subtotal + shipping_fee)
            created = NOW - timedelta(days=45 - order_index * 3)
            order = {
                "user_id": str(users["customer"]["_id"]), "user_name": users["customer"]["name"],
                "items": items, "total_amount": float(subtotal), "discount": 0.0,
                "delivery_charge": float(shipping_fee), "shipping_fee": float(shipping_fee),
                "parcel_weight": parcel_weight, "final_amount": float(final),
                "address": {"name": users["customer"]["name"], "phone": users["customer"]["phone"],
                            "address_line1": "42 Green Lane", "city": "Colombo", "state": "Western", "pincode": "00700"},
                "payment_method": "stripe" if order_index < 10 else "cod",
                "payment_status": "completed" if order_index < 10 else "pending",
                "payment_id": f"STRIPE-SEED-{order_index + 1:04d}" if order_index < 10 else None,
                "status": status, "prescription_id": None, "notes": "Demo seeded order",
                "courier_service": "Sri Lanka Post" if status in {"packed", "delivered"} else None,
                "tracking_number": f"SLPOST{order_index + 1:06d}" if status in {"packed", "delivered"} else None,
                "shipping_date": created + timedelta(days=1) if status in {"packed", "delivered"} else None,
                "delivery_status": "delivered" if status == "delivered" else "packed" if status == "packed" else "accepted" if status == "confirmed" else "pending",
                "last_status_updated": created + timedelta(days=2),
                "invoice_url": None, "created_at": created, "updated_at": created + timedelta(hours=2), **SEED,
            }
            result = await db.orders.insert_one(order)
            order["_id"] = result.inserted_id
            order_docs.append(order)
            if order_index < 10:
                completed_orders.append(order)
            await db.deliveries.insert_one({
                "order_id": str(result.inserted_id), "delivery_partner_id": str(users["delivery"]["_id"]),
                "status": "delivered" if status == "delivered" else "assigned",
                "current_location": {"lat": 6.9271 + order_index * .002, "lng": 79.8612 + order_index * .002},
                "estimated_delivery": created + timedelta(days=2),
                "actual_delivery": created + timedelta(days=1) if status == "delivered" else None,
                "otp": f"{4100 + order_index}", "notes": "Seeded delivery",
                "created_at": created, "updated_at": NOW, **SEED,
            })
        print("Seeded 10 completed orders and 5 pending orders")

        # Reviews are tied to delivered orders and update product rating statistics.
        review_counts = {}
        review_sums = {}
        review_titles = ["Excellent quality", "Fresh and authentic", "Good value", "Will order again"]
        for index, order in enumerate(completed_orders):
            for item_index, item in enumerate(order["items"]):
                rating = 4 + ((index + item_index) % 2)
                await db.reviews.insert_one({
                    "user_id": str(users["customer"]["_id"]), "user_name": users["customer"]["name"],
                    "medicine_id": item["medicine_id"], "order_id": str(order["_id"]), "rating": rating,
                    "title": review_titles[(index + item_index) % len(review_titles)],
                    "comment": "A well-packed, authentic herbal product with prompt local delivery.",
                    "created_at": order["created_at"] + timedelta(days=2), **SEED,
                })
                review_counts[item["medicine_id"]] = review_counts.get(item["medicine_id"], 0) + 1
                review_sums[item["medicine_id"]] = review_sums.get(item["medicine_id"], 0) + rating
        for medicine_id, count in review_counts.items():
            await db.medicines.update_one({"_id": ObjectId(medicine_id)}, {"$set": {
                "average_rating": round(review_sums[medicine_id] / count, 1), "review_count": count,
            }})
        print("Seeded 20 verified customer reviews")

        commission_rate = Decimal("10.00")
        await db.commission_settings.update_one({"seed_data": True}, {"$set": {
            "percentage": str(commission_rate), "created_by": str(users["admin"]["_id"]),
            "effective_from": NOW - timedelta(days=365), "created_at": NOW - timedelta(days=365), **SEED,
        }}, upsert=True)

        payout_number = 0
        for order_index, order in enumerate(order_docs):
            order_id = str(order["_id"])
            financial_status = "PAID" if order_index < 10 else "PENDING"
            await db.financial_orders.insert_one({
                "order_id": order_id, "customer_id": str(users["customer"]["_id"]),
                "total_amount": f"{order['final_amount']:.2f}", "currency": "LKR",
                "payment_status": financial_status, "order_status": order["status"].upper(),
                "created_at": order["created_at"], "updated_at": NOW, **SEED,
            })
            payment_doc = {
                "order_id": order_id, "payment_gateway": "stripe" if order_index < 10 else "cod",
                "amount": f"{order['final_amount']:.2f}", "currency": "LKR", "status": financial_status,
                "created_at": order["created_at"], "updated_at": NOW, **SEED,
            }
            if order_index < 10:
                payment_doc.update({
                    "transaction_id": f"STRIPE-SEED-{order_index + 1:04d}",
                    "webhook_payload_hash": f"demo-hash-{order_index + 1}",
                    "paid_at": order["created_at"] + timedelta(minutes=5),
                })
            await db.payments.insert_one(payment_doc)
            seller_totals = {}
            for item in order["items"]:
                med = next(m for m in medicines if str(m["_id"]) == item["medicine_id"])
                seller_totals[med["seller_id"]] = seller_totals.get(med["seller_id"], Decimal("0")) + money(item["price"] * item["quantity"])
            total_products = sum(seller_totals.values(), Decimal("0"))
            final_amount = money(order["final_amount"])
            allocated_so_far = Decimal("0")
            entries = list(seller_totals.items())
            for allocation_index, (seller_user_id, product_gross) in enumerate(entries):
                gross = money(final_amount - allocated_so_far) if allocation_index == len(entries) - 1 else money(final_amount * product_gross / total_products)
                allocated_so_far += gross
                seller = next(s for s in sellers if s["user_id"] == seller_user_id)
                commission = money(gross * commission_rate / Decimal("100"))
                net = money(gross - commission)
                allocation = {"order_id": order_id, "seller_id": str(seller["_id"]),
                              "seller_user_id": seller_user_id, "gross_amount": str(gross),
                              "commission_rate": str(commission_rate), "commission_amount": str(commission),
                              "net_amount": str(net), "created_at": order["created_at"], **SEED}
                allocation_result = await db.seller_order_allocations.insert_one(allocation)
                if order_index < 10:
                    payout_number += 1
                    payout_status = "PAID" if order_index < 5 else "READY_FOR_MANUAL_TRANSFER"
                    bank = await db.seller_bank_accounts.find_one({"seller_id": str(seller["_id"])})
                    payout_doc = {
                        "seller_id": str(seller["_id"]), "seller_user_id": seller_user_id,
                        "order_id": order_id, "allocation_id": str(allocation_result.inserted_id),
                        "bank_account_id": str(bank["_id"]), "gross_amount": str(gross),
                        "commission_rate": str(commission_rate), "commission_amount": str(commission),
                        "net_amount": str(net), "status": payout_status, "payout_mode": "manual",
                        "provider": "manual_bank_transfer",
                        "transaction_reference": f"BANK-DEMO-{payout_number:04d}" if payout_status == "PAID" else None,
                        "failure_reason": None, "retry_count": 1 if payout_status == "PAID" else 0,
                        "created_at": order["created_at"] + timedelta(days=2), "updated_at": NOW,
                        "paid_at": order["created_at"] + timedelta(days=4) if payout_status == "PAID" else None, **SEED,
                    }
                    payout_result = await db.payouts.insert_one(payout_doc)
                    if payout_status == "PAID":
                        await db.payout_attempts.insert_one({
                            "payout_id": str(payout_result.inserted_id), "attempt_number": 1,
                            "provider": "manual_bank_transfer", "status": "PAID",
                            "request_reference": payout_doc["transaction_reference"], "failure_reason": None,
                            "created_at": payout_doc["paid_at"], **SEED,
                        })
        print(f"Seeded 15 payment records and {payout_number} seller payout records")

        await db.notifications.insert_many([
            {"user_id": str(users["customer"]["_id"]), "type": "order", "title": "Welcome to Herbal Hub",
             "message": "Your demo orders and reviews are ready to explore.", "is_read": False,
             "link": "/orders", "created_at": NOW, **SEED},
            *[{"user_id": str(users[f"seller{i}"]["_id"]), "type": "payout", "title": "Seller account approved",
               "message": "Your demo seller profile and payout history are ready.", "is_read": False,
               "link": "/seller/earnings", "created_at": NOW, **SEED} for i in range(1, 4)],
        ])

        # Important indexes used by authentication and idempotent payment processing.
        await db.users.create_index("email", unique=True)
        await db.users.create_index("phone", unique=True)
        await db.payments.create_index("transaction_id", unique=True, sparse=True)
        await db.payouts.create_index("allocation_id", unique=True)

        print("\nHerbal Hub demo database seeded successfully.")
        print("Seed accounts created. Credentials are not printed or stored in source code.")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(seed())
