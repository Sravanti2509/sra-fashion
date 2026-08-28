import Razorpay from "razorpay";

export const prerender = false;

export async function POST({ request }) {
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

    const keyId = import.meta.env.RAZORPAY_KEY_ID;
    const keySecret = import.meta.env.RAZORPAY_KEY_SECRET;

    console.log("RAZORPAY KEY ID EXISTS:", !!keyId);
    console.log("RAZORPAY SECRET EXISTS:", !!keySecret);

    if (!keyId || !keySecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Razorpay server keys are missing. Check .env",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt,
    });

    console.log("RAZORPAY ORDER CREATED:", order.id);

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