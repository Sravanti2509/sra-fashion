export const prerender = false;

export async function POST({ request, locals }) {
  try {
    const body = await request.json();

    const amount = Number(body.amount);
    const receipt = body.receipt || `SRA-${Date.now()}`;

    console.log("CREATE ORDER REQUEST:", {
      amount,
      receipt,
    });

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

    const keyId = locals.runtime.env.RAZORPAY_KEY_ID;
    const keySecret = locals.runtime.env.RAZORPAY_KEY_SECRET;

    console.log("RAZORPAY KEY ID EXISTS:", !!keyId);
    console.log("RAZORPAY SECRET EXISTS:", !!keySecret);

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

    const auth = btoa(`${keyId}:${keySecret}`);

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

    const responseText = await razorpayResponse.text();

    console.log("RAZORPAY RESPONSE STATUS:", razorpayResponse.status);
    console.log("RAZORPAY RESPONSE:", responseText);

    if (!razorpayResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: responseText || "Razorpay order creation failed",
        }),
        {
          status: razorpayResponse.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const order = JSON.parse(responseText);

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
    console.error("RAZORPAY CREATE ORDER ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unable to create Razorpay order",
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