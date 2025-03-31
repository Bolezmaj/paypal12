const express = require("express");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());


app.set('trust proxy', 1);


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,  // Limit each IP to 100 requests per window
    message: "Too many requests, please try again later."
});
app.use(limiter);

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = "https://api-m.sandbox.paypal.com"; // Change to live URL when in production
const KEYAUTH_SELLER_KEY = process.env.KEYAUTH_SELLER_KEY;
const PORT = process.env.PORT || 5000;

app.use(express.static('public'));

app.get("/", (req, res) => {
    res.send("Welcome to the PayPal API! Your backend is up and running.");
});


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

        console.log("✅ PayPal Access Token received:", response.data);
        return response.data.access_token;

    } catch (error) {
        console.error("❌ Error getting PayPal access token:", error.response?.data || error.message);
        throw new Error("Failed to get PayPal access token.");
    }
}



app.post("/api/paypal/create-order", async (req, res) => {
    try {
        const { price, currency } = req.body;
        if (!price || !currency) {
            return res.status(400).json({ error: "Price and currency are required." });
        }

        const accessToken = await getPayPalAccessToken();
        const orderData = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    items: [
                        {
                            name: "Software License Key",
                            description: "Your License Key will be delivered after payment.",
                            quantity: 1,
                            unit_amount: {
                                currency_code: currency,
                                value: price
                            }
                        }
                    ],
                    amount: {
                        currency_code: currency,
                        value: price,
                        breakdown: {
                            item_total: {
                                currency_code: currency,
                                value: price
                            }
                        }
                    }
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

        res.json({ orderID: response.data.id });
    } catch (error) {
        console.error("Error creating PayPal order:", error.stack);
        res.status(500).json({ error: "Failed to create PayPal order." });
    }
});


const sendLicenseEmail = require("./emailService"); // Import the email function

app.post("/api/paypal/capture-order", async (req, res) => {
    try {
        const { orderID } = req.body; // Get order ID from request

        console.log("Capturing PayPal order:", orderID);

        const accessToken = await getPayPalAccessToken();

        // Capture the PayPal order
        const captureResponse = await axios.post(
            `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
            {},
            {
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
            }
        );

        console.log("Capture successful:", captureResponse.data);

        // Extract buyer's email from PayPal API response
        const payerEmail = captureResponse.data.payer.email_address;
        console.log("Buyer’s Email:", payerEmail);

        // Generate a license key
        const licenseKey = await generateLicenseKey();
        console.log("Generated License Key:", licenseKey);

        // Send email with the license key to the PayPal buyer's email
        await sendLicenseEmail(payerEmail, licenseKey);
        console.log("📧 Email sent successfully to:", payerEmail);

        res.json({ licenseKey, message: `License key sent to ${payerEmail}` });

    } catch (error) {
        console.error("❌ Error capturing PayPal order:", error.stack);
        res.status(500).json({ error: "Failed to capture PayPal order." });
    }
});




app.get("/complete-order", (req, res) => {
    const licenseKey = req.query.licenseKey; // Get the license key from the query parameter
    
    if (!licenseKey) {
        return res.status(400).send("License key not found.");
    }


    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Successful</title>
        </head>
        <body>
            <h1>Payment Successful!</h1>
            <p>Your License Key: <strong>${licenseKey}</strong></p>
        </body>
        </html>
    `);
});



async function generateLicenseKey() {
    try {
        console.log("Requesting license key...");
        const keyAuthURL = `https://keyauth.win/api/seller/?sellerkey=8094dc53fe56db47f027e8fa24891ad7&type=add&expiry=1&mask=******-******-******-******-******-******&level=1&amount=1&format=text`;

        const response = await axios.get(keyAuthURL);

        const licenseKey = response.data.trim();  // Extract key from response
        if (!licenseKey) throw new Error("Failed to generate license key.");

        return licenseKey;
    } catch (error) {
        console.error("Error generating license key:", error.stack);
        throw new Error("Failed to generate license key.");
    }
}


app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
