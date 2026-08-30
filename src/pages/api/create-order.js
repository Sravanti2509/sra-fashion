import { env } from "cloudflare:workers";

export const prerender = false;

export async function POST({ request }) {
  try {
    // Read request body
    const body = await request.json();

    const amount = Number(body.amount);
    const receipt = body.receipt || `SRA-${Date.now()}`;

    console.log("CREATE ORDER REQUEST:", {
      amount,
      receipt,
    });

    // Validate amount
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid amount",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Cloudflare Worker secrets
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;

    // IMPORTANT: Only log whether keys exist.
    // Never log the actual secret values.
    console.log("RAZORPAY KEY ID EXISTS:", !!keyId);
    console.log("RAZORPAY SECRET EXISTS:", !!keySecret);

    // Check secrets
    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Razorpay server keys are missing",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Razorpay Basic Authentication
    const auth = btoa(`${keyId}:${keySecret}`);

    // Create Razorpay order
    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",

        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: "INR",
          receipt,
        }),
      },
    );

    // Read response safely as text first
    const responseText = await razorpayResponse.text();

    console.log(
      "RAZORPAY RESPONSE STATUS:",
      razorpayResponse.status,
    );

    console.log(
      "RAZORPAY RESPONSE:",
      responseText,
    );

    // Razorpay returned an error
    if (!razorpayResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            responseText ||
            "Razorpay order creation failed",
        }),
        {
          status: razorpayResponse.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Make sure Razorpay returned something
    if (!responseText) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Empty response from Razorpay",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Parse Razorpay response
    let order;

    try {
      order = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "RAZORPAY JSON PARSE ERROR:",
        parseError,
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid response received from Razorpay",
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Success
    console.log(
      "RAZORPAY ORDER CREATED:",
      order.id,
    );

    return new Response(
      JSON.stringify({
        success: true,
        order,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "RAZORPAY CREATE ORDER ERROR:",
      error,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error?.message ||
          "Unable to create Razorpay order",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
