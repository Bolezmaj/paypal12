const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config(); // Load environment variables from .env file

const app = express();
app.use(express.json());
app.use(cors());

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;  // PayPal Client ID
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;        // PayPal Secret
const PAYPAL_API = "https://api-m.sandbox.paypal.com";   // PayPal Sandbox API URL
const PORT = process.env.PORT || 5000;  // Default port for local development or Render port

// ✅ Default Route to Avoid "Cannot GET /"
app.get("/", (req, res) => {
    res.send("Welcome to the PayPal API! Your backend is up and running.");
});

// ✅ Function to Get PayPal Access Token
async function getPayPalAccessToken() {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
        const response = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, "grant_type=client_credentials", {
            headers: { 
                Authorization: `Basic ${auth}`, 
                "Content-Type": "application/x-www-form-urlencoded" 
            },
        });
        return response.data.access_token; // Return the access token for subsequent API calls
    } catch (error) {
        console.error("Error getting PayPal access token:", error.response?.data || error.message);
        throw new Error("Failed to get PayPal access token.");
    }
}

// ✅ Create PayPal Order Endpoint
app.post("/api/paypal/create-order", async (req, res) => {
    try {
        const accessToken = await getPayPalAccessToken();  // Get access token

        // Make a request to PayPal API to create an order
        const order = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders`,
            {
                intent: "CAPTURE", // We want to immediately capture the payment
                purchase_units: [{ 
                    amount: { currency_code: "USD", value: req.body.amount || "10.00" }  // Dynamic amount from request
                }],
            },
            { 
                headers: { 
                    Authorization: `Bearer ${accessToken}`, 
                    "Content-Type": "application/json" 
                }
            }
        );

        // Return PayPal order details to the client
        res.json(order.data);
    } catch (error) {
        console.error("Error creating PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to create PayPal order." });
    }
});

// ✅ Capture PayPal Order Endpoint
app.post("/api/paypal/capture-order", async (req, res) => {
    try {
        const { orderID } = req.body;  // Extract order ID from the request
        const accessToken = await getPayPalAccessToken();  // Get access token

        // Make a request to PayPal API to capture the payment for the given order
        const captureResponse = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
            {},
            { 
                headers: { 
                    Authorization: `Bearer ${accessToken}`, 
                    "Content-Type": "application/json" 
                } 
            }
        );

        // Return the capture response (indicates payment success)
        res.json(captureResponse.data);
    } catch (error) {
        console.error("Error capturing PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});

// ✅ Start Server (listens on the configured port)
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
