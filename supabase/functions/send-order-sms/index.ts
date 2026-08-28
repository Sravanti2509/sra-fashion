import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // =========================
  // CORS
  // =========================
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Only POST method is allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    // =========================
    // REQUEST BODY
    // =========================
    let body;

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON request body",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const name = String(body?.name || "Customer");
    const phone = String(body?.phone || "");
    const orderNumber = String(body?.orderNumber || "");
    const total = Number(body?.total || 0);
    const payment = String(
      body?.payment || "Cash on Delivery",
    );

    console.log("ORDER REQUEST:", {
      name,
      orderNumber,
      total,
      payment,
      phoneProvided: Boolean(phone),
    });

    // =========================
    // PHONE VALIDATION
    // =========================
    let customerPhone = phone.replace(/\D/g, "");

    if (customerPhone.length === 12 && customerPhone.startsWith("91")) {
      customerPhone = customerPhone.substring(2);
    }

    if (customerPhone.length !== 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please provide a valid 10 digit Indian phone number",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    customerPhone = "+91" + customerPhone;

    // =========================
    // TWILIO SECRETS
    // =========================
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    console.log("TWILIO CONFIG:", {
      accountSidExists: Boolean(accountSid),
      authTokenExists: Boolean(authToken),
      twilioPhoneExists: Boolean(twilioPhone),
    });

    if (!accountSid || !authToken || !twilioPhone) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Twilio secrets are missing. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER in Supabase.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // =========================
    // SMS MESSAGE
    // =========================
    const message =
      `SRA COLLECTION: Thank you ${name}! ` +
      `Your order ${orderNumber} is confirmed. ` +
      `Total: Rs.${total.toLocaleString("en-IN")}. ` +
      `Payment: ${payment}. ` +
      `We will notify you when your order ships.`;

    console.log("SMS DESTINATION:", customerPhone);
    console.log("ORDER NUMBER:", orderNumber);

    // =========================
    // TWILIO REQUEST
    // =========================
    const formData = new URLSearchParams();

    formData.append("To", customerPhone);
    formData.append("From", twilioPhone);
    formData.append("Body", message);

    const credentials = btoa(
      `${accountSid}:${authToken}`,
    );

    const twilioUrl =
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    console.log("Calling Twilio...");

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",

      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: formData.toString(),
    });

    // =========================
    // READ TWILIO RESPONSE SAFELY
    // =========================
    const responseText = await twilioResponse.text();

    console.log("TWILIO HTTP STATUS:", twilioResponse.status);
    console.log("TWILIO RESPONSE:", responseText);

    let twilioResult;

    try {
      twilioResult = JSON.parse(responseText);
    } catch {
      twilioResult = {
        rawResponse: responseText,
      };
    }

    // =========================
    // TWILIO ERROR
    // =========================
    if (!twilioResponse.ok) {
      console.error(
        "TWILIO SMS ERROR:",
        twilioResult,
      );

      return new Response(
        JSON.stringify({
          success: false,
          error:
            twilioResult?.message ||
            "Twilio SMS failed",
          code:
            twilioResult?.code ||
            null,
          moreInfo:
            twilioResult?.more_info ||
            null,
          twilioStatus:
            twilioResponse.status,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // =========================
    // SUCCESS
    // =========================
    console.log(
      "SMS SENT SUCCESSFULLY:",
      twilioResult?.sid,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Order confirmation SMS sent successfully",
        sid: twilioResult?.sid || null,
        orderNumber,
        phone: customerPhone,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );

  } catch (error) {
    console.error(
      "SEND ORDER SMS ERROR:",
      error,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});