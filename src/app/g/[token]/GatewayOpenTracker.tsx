"use client";

import { useEffect } from "react";
import { recordGatewayOpened } from "@/modules/gateway/actions";

export function GatewayOpenTracker({ token }: { token: string }) {
  useEffect(() => {
    void recordGatewayOpened(token);
  }, [token]);

  return null;
}

