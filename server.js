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
const KEYAUTH_SELLER_KEY = process.env.KEYAUTH_SELLER_KEY; // KeyAuth Seller Key
const KEYAUTH_API_URL = "https://keyauth.win/api/seller/";  // KeyAuth API URL
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

// ✅ Generate License Key from KeyAuth API
async function generateLicenseKey() {
    try {
        // Make a request to KeyAuth API to generate a license
        const response = await axios.get(`https://keyauth.win/api/seller/?sellerkey=9f889ee9b2606ed73c72ed19a924eef9&type=add&expiry=1&mask=******-******-******-******-******-******&level=1&amount=1&format=text`);
        return response.data; // Return the generated license key
    } catch (error) {
        console.error("Error generating license key:", error.response?.data || error.message);
        throw new Error("Failed to generate license key.");
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

        // Check if PayPal order was successfully captured
        if (captureResponse.data.status === 'COMPLETED') {
            // Generate license key from KeyAuth API after successful payment
            const licenseKey = await generateLicenseKey();
            // Respond with both capture response and the generated license key
            res.json({ captureData: captureResponse.data, licenseKey });
        } else {
            res.status(400).json({ error: "Payment not completed successfully." });
        }
    } catch (error) {
        console.error("Error capturing PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});

// ✅ Start Server (listens on the configured port)
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
