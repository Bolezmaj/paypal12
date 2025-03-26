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
const KEYAUTH_SELLER_KEY = process.env.KEYAUTH_SELLER_KEY;
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("Welcome to the PayPal API! Your backend is up and running.");
});

// Function to get PayPal access token
async function getPayPalAccessToken() {
    try {
        console.log("Requesting PayPal access token...");
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
        const response = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, "grant_type=client_credentials", {
            headers: { 
                Authorization: `Basic ${auth}`, 
                "Content-Type": "application/x-www-form-urlencoded",
                Connection: "keep-alive"  
            },
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Error getting PayPal access token:", error.response?.data || error.message);
        throw new Error("Failed to get PayPal access token.");
    }
}

// ✅ Create PayPal Order with License Key
app.post("/api/paypal/create-order", async (req, res) => {
    try {
        const { price, currency, userID, hwid } = req.body;

        // Generate license key before payment
        console.log("Generating license key before payment...");
        const licenseKey = await generateLicenseKey(userID, hwid);

        const accessToken = await getPayPalAccessToken();
        const orderData = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    amount: {
                        currency_code: currency || "USD",
                        value: price || "10.00"
                    },
                    description: `License Key: ${licenseKey}`,  // 🛑 Shown on invoice
                    custom_id: licenseKey,  // ✅ Custom field for tracking
                    invoice_id: `INV-${Date.now()}-${userID}`  // Unique invoice ID
                }
            ],
            application_context: {
                return_url: "https://yourfrontend.com/success",
                cancel_url: "https://yourfrontend.com/cancel"
            }
        };

        const response = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, orderData, {
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
        });

        res.json({ orderID: response.data.id, licenseKey });
    } catch (error) {
        console.error("Error creating PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to create PayPal order." });
    }
});

// ✅ Capture PayPal Order
app.post("/api/paypal/capture-order", async (req, res) => {
    try {
        const { orderID } = req.body;
        console.log("Checking PayPal order status before capture:", orderID);

        const accessToken = await getPayPalAccessToken();

        // 🔹 First, get the order details
        const orderResponse = await axios.get(`${PAYPAL_API}/v2/checkout/orders/${orderID}`, {
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
        });

        console.log("Order Status:", orderResponse.data.status);

        // 🔹 Check if the order is already captured
        if (orderResponse.data.status === "COMPLETED") {
            console.log("Order already captured, skipping capture.");
            return res.status(400).json({ message: "Order already captured." });
        }

        // 🔹 Proceed to capture the order
        console.log("Capturing PayPal order:", orderID);
        const captureResponse = await axios.post(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {}, {
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
        });

        console.log("Capture successful:", captureResponse.data);

        res.json({ captureData: captureResponse.data });
    } catch (error) {
        console.error("Error capturing PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});


// Function to generate a license key using KeyAuth API
async function generateLicenseKey(userID, hwid) {
    try {
        console.log("Requesting license key generation...");
        const keyAuthURL = "https://keyauth.win/api/seller/";
        
        const params = {
            sellerkey: KEYAUTH_SELLER_KEY, 
            type: "add",
            expiry: "1",
            mask: "******-******-******-******-******-******",
            level: 1,
            amount: 1,
            format: "text"
        };

        const response = await axios.get(keyAuthURL, { params });

        console.log("KeyAuth response received:", response.data);
        const licenseKey = typeof response.data === "string" ? response.data.trim() : response.data.license;

        if (!licenseKey) {
            throw new Error("Failed to retrieve license key.");
        }

        return licenseKey;
    } catch (error) {
        console.error("Error generating license key:", error.response?.data || error.message);
        throw new Error("Failed to generate license key.");
    }
}

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
