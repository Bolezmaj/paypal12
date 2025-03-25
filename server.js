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
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("Welcome to the PayPal API! Your backend is up and running.");
});

async function getPayPalAccessToken() {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
        const response = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, "grant_type=client_credentials", {
            headers: { 
                Authorization: `Basic ${auth}`, 
                "Content-Type": "application/x-www-form-urlencoded" 
            },
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Error getting PayPal access token:", error.response?.data || error.message);
        throw new Error("Failed to get PayPal access token.");
    }
}

// Create PayPal Order
app.post("/api/paypal/create-order", async (req, res) => {
    try {
        const accessToken = await getPayPalAccessToken();
        const order = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders`,
            {
                intent: "CAPTURE",
                purchase_units: [{ 
                    amount: { currency_code: "USD", value: req.body.amount || "10.00" }
                }],
            },
            { 
                headers: { 
                    Authorization: `Bearer ${accessToken}`, 
                    "Content-Type": "application/json" 
                }
            }
        );
        res.json(order.data);
    } catch (error) {
        console.error("Error creating PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to create PayPal order." });
    }
});

// Capture PayPal Order with additional validation
app.post("/api/paypal/capture-order", async (req, res) => {
    try {
        const { orderID } = req.body;
        const accessToken = await getPayPalAccessToken();
        
        // Check the order status before capturing it
        const orderStatus = await axios.get(
            `${PAYPAL_API}/v2/checkout/orders/${orderID}`,
            {
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // If the order is already captured, return a specific message
        if (orderStatus.data.status === "COMPLETED") {
            return res.status(400).json({ error: "Order already captured." });
        }

        // If the order has not been captured, proceed with capturing it
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

        // If the capture is successful, return the capture data and license key
        const licenseKey = await generateLicenseKey();  // Replace with your license generation logic
        res.json({ captureData: captureResponse.data, licenseKey });
    } catch (error) {
        console.error("Error capturing PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});

// Dummy function for generating license key (replace with real logic)
async function generateLicenseKey() {
    // Replace with your actual license key generation code (e.g., calling KeyAuth API)
    return "https://keyauth.win/api/seller/?sellerkey=9f889ee9b2606ed73c72ed19a924eef9&type=add&expiry=1&mask=******-******-******-******-******-******&level=1&amount=1&format=text";
}

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
