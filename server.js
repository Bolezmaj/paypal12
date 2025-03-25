const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = "https://api-m.sandbox.paypal.com";
const PORT = process.env.PORT || 5000; // Use Render's assigned port if available

// ✅ Default Route to Avoid "Cannot GET /"
app.get("/", (req, res) => {
    res.send("Welcome to the PayPal API!");
});

// ✅ Function to Get PayPal Access Token
async function getPayPalAccessToken() {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
        const response = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, "grant_type=client_credentials", {
            headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Error getting PayPal access token:", error.response?.data || error.message);
        throw new Error("Failed to get PayPal access token.");
    }
}

// ✅ Create PayPal Order Endpoint
app.post("/api/paypal/create-order", async (req, res) => {
    try {
        const accessToken = await getPayPalAccessToken();
        const order = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders`,
            {
                intent: "CAPTURE",
                purchase_units: [{ amount: { currency_code: "USD", value: "10.00" } }],
            },
            { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
        );
        res.json(order.data);
    } catch (error) {
        console.error("Error creating PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to create PayPal order." });
    }
});

// ✅ Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
