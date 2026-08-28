import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // CORS
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
    const body = await req.json();

    const orderNumber = String(body.orderNumber || "");
    const userId = String(body.userId || "");

    if (!orderNumber) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Order number is required",
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

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "User ID is required",
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

    // Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // Find the user's order
    const { data: order, error: findError } =
      await supabase
        .from("orders")
        .select(
          "id, order_number, user_id, order_status, payment_status",
        )
        .eq("order_number", orderNumber)
        .eq("user_id", userId)
        .maybeSingle();

    if (findError) {
      console.error(
        "ORDER FIND ERROR:",
        findError,
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: findError.message,
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

    if (!order) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Order not found",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Already cancelled
    if (
      order.order_status?.toLowerCase() ===
      "cancelled"
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Order is already cancelled",
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

    // Don't allow cancellation after shipping/delivery
    const currentStatus =
      order.order_status?.toLowerCase();

    if (
      currentStatus === "shipped" ||
      currentStatus === "out_for_delivery" ||
      currentStatus === "delivered"
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "This order can no longer be cancelled",
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

    // Cancel order
    const { error: updateError } =
      await supabase
        .from("orders")
        .update({
          order_status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("user_id", userId);

    if (updateError) {
      console.error(
        "ORDER UPDATE ERROR:",
        updateError,
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: updateError.message,
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order cancelled successfully",
        orderNumber: order.order_number,
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
      "CANCEL ORDER ERROR:",
      error,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong",
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