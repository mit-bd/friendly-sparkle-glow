import { supabase } from "@/integrations/supabase/client";

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: "admin" | "manager" | "accountant" | "viewer";
}

/**
 * Create a user via the `admin-create-user` edge function. The function
 * enforces that the caller is an authenticated admin and performs the
 * service-role operations server-side.
 */
export async function createUser(input: CreateUserInput): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: input,
  });

  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        /* ignore parse failures */
      }
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data as { id: string };
}