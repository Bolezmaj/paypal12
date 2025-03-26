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
                Connection: "keep-alive"  // Prevents disconnections
            },
        });
        console.log("Access token received.");
        return response.data.access_token;
    } catch (error) {
        console.error("Error getting PayPal access token:", error.response?.data || error.message);
        throw new Error("Failed to get PayPal access token.");
    }
}

// Capture PayPal Order and generate a license key
app.post("/api/paypal/capture-order", async (req, res) => {
    try {
        const { orderID, userID, hwid } = req.body;
        console.log("Processing order:", { orderID, userID, hwid });

        const accessToken = await getPayPalAccessToken();

        // Check order status before capturing it
        console.log(`Checking PayPal order status: ${orderID}`);
        const orderStatus = await axios.get(`${PAYPAL_API}/v2/checkout/orders/${orderID}`, {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        if (orderStatus.data.status === "COMPLETED") {
            console.log("Order already captured.");
            return res.status(400).json({ error: "Order already captured." });
        }

        // Capture the payment
        console.log(`Capturing PayPal order: ${orderID}`);
        const captureResponse = await axios.post(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {}, {
            headers: { 
                Authorization: `Bearer ${accessToken}`, 
                "Content-Type": "application/json"
            }
        });

        // Generate a license key after successful payment
        console.log("Generating license key...");
        const licenseKey = await generateLicenseKey(userID, hwid);

        // Send response with PayPal capture data and generated license key
        console.log("License key generated successfully:", licenseKey);
        res.json({ captureData: captureResponse.data, licenseKey });

    } catch (error) {
        console.error("Error capturing PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});

// Function to generate license key using KeyAuth API
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

        // If the response is plain text, use response.data directly
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
