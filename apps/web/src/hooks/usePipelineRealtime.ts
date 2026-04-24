"use client";

import { useEffect, useRef } from "react";
import Pusher from "pusher-js";

export interface OpportunityMovedEvent {
  opportunityId: string;
  fromStageId: string;
  toStageId: string;
  movedBy: string;
}

interface Options {
  tenantId: string;
  userId: string;
  onOpportunityMoved: (event: OpportunityMovedEvent) => void;
}

/**
 * Hook que conecta ao Soketi e escuta eventos de movimentação no pipeline.
 * Ignora eventos disparados pelo próprio usuário (já aplicou otimisticamente).
 * Silencioso se NEXT_PUBLIC_SOKETI_APP_KEY não estiver configurado.
 */
export function usePipelineRealtime({ tenantId, userId, onOpportunityMoved }: Options) {
  const callbackRef = useRef(onOpportunityMoved);
  callbackRef.current = onOpportunityMoved;

  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_SOKETI_APP_KEY;
    const host   = process.env.NEXT_PUBLIC_SOKETI_HOST;
    if (!appKey || !host) return; // Soketi não configurado — modo silencioso

    const pusher = new Pusher(appKey, {
      wsHost:           host,
      wsPort:           443,
      wssPort:          443,
      forceTLS:         true,
      disableStats:     true,
      enabledTransports: ["ws", "wss"],
      cluster:          "mt1", // ignorado pelo Soketi — obrigatório pela tipagem do pusher-js
      // Endpoint de auth para canais private-* (obrigatório para Soketi)
      authEndpoint:     "/api/pusher/auth",
    });

    const channel = pusher.subscribe(`private-pipeline-${tenantId}`);

    channel.bind("opportunity.moved", (data: OpportunityMovedEvent) => {
      // Ignora eventos do próprio usuário — já aplicou otimisticamente no drag
      if (data.movedBy === userId) return;
      callbackRef.current(data);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-pipeline-${tenantId}`);
      pusher.disconnect();
    };
  }, [tenantId, userId]);
}
