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

// Function to get PayPal access token
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

// Capture PayPal Order and generate a license key
// Create PayPal Order
// Capture PayPal Order and generate a license key
app.post("/api/paypal/capture-order", async (req, res) => {
    try {
        const { orderID, userID, hwid } = req.body;
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
        
        console.log("Order Status: ", orderStatus.data); // Log the order status for debugging

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

        console.log("Capture Response: ", captureResponse.data); // Log the capture response

        // Generate the license key
        const licenseKey = await generateLicenseKey(userID, hwid);

        res.json({ captureData: captureResponse.data, licenseKey });
    } catch (error) {
        console.error("Error capturing PayPal order:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});


// Function to generate license key (use KeyAuth API or other service)
async function generateLicenseKey(userID, hwid) {
    try {
        // Replace this URL with the actual KeyAuth API or another license generation service
        const keyAuthURL = "https://keyauth.win/api/seller/";
        const params = {
            sellerkey: process.env.KEYAUTH_SELLER_KEY, // Make sure this is set in your environment variables
            type: "add",
            expiry: "1",  // Set expiry for the license
            mask: "******-******-******-******-******-******", // Mask for the license key
            level: 1,  // Level of the license
            amount: 1,  // Amount of licenses to generate (1 for now)
            format: "text"  // Set the response format to text
        };

        const response = await axios.get(keyAuthURL, { params });

        if (response.data && response.data.license) {
            return response.data.license;  // License key returned from KeyAuth API
        } else {
            throw new Error("Failed to generate license key.");
        }
    } catch (error) {
        console.error("Error generating license key:", error.response?.data || error.message);
        throw new Error("Failed to generate license key.");
    }
}

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
