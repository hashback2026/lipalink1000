require("dotenv").config();
const express = require("express");
const axios = require("axios");
const PQueue = require("p-queue").default;

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// Rate limiter
const queue = new PQueue({
  interval: 1000,
  intervalCap: 3
});

const API_URL = "http://lipalink.co.ke/api/stk_push.php";

async function sendSTK(msisdn, amount) {
  try {
    const { data } = await axios.post(
      API_URL,
      {
        amount: amount,
        msisdn: msisdn,
        reference: `REF-${Date.now()}`,
        business_id: process.env.BUSINESS_ID
      },
      {
        headers: {
          "X-Api-Key": process.env.API_KEY
        }
      }
    );

    return {
      phone: msisdn,
      success: data.success,
      transaction_id: data.transaction_id || null,
      error: data.error || null
    };
  } catch (error) {
    return {
      phone: msisdn,
      success: false,
      error: error.response?.data || error.message
    };
  }
}

app.post("/send-bulk", async (req, res) => {
  const { numbers, amount } = req.body;

  if (!numbers || !amount) {
    return res.status(400).json({ error: "Missing numbers or amount" });
  }

  const results = [];

  const tasks = numbers.map((num) =>
    queue.add(async () => {
      const result = await sendSTK(num.trim(), amount);
      results.push(result);
    })
  );

  await Promise.all(tasks);

  res.json({ total: results.length, results });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
