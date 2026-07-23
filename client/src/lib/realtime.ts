import Echo from "laravel-echo";
import Pusher from "pusher-js";

type BookingRealtimeConfig = {
  tenantId: string;
  enabled: boolean;
  key: string;
  wsHost: string;
  wsPort: number;
  wssPort: number;
  forceTLS: boolean;
};

declare global {
  interface Window {
    __BOOKING_REALTIME__?: BookingRealtimeConfig;
    Pusher?: typeof Pusher;
  }
}

let echoInstance: Echo<"reverb"> | null = null;
let echoInstanceHost: string | null = null;

const getConfig = (): BookingRealtimeConfig | null => {
  if (typeof window === "undefined") return null;
  return window.__BOOKING_REALTIME__ ?? null;
};

const normalizeHost = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/:\d+$/, "")
    .replace(/\/+$/, "");

  if (!normalized || normalized === "0.0.0.0") {
    return null;
  }

  return normalized;
};

const getPreferredWsHost = (config: BookingRealtimeConfig): string | null => {
  const candidates = [
    normalizeHost(config.wsHost),
    typeof window !== "undefined" ? normalizeHost(window.location.hostname) : null,
    "localhost",
    "127.0.0.1",
  ];

  const uniqueHosts = candidates.filter((host, index, values): host is string => {
    return Boolean(host) && values.indexOf(host) === index;
  });

  return uniqueHosts[0] ?? null;
};

const getEcho = () => {
  const config = getConfig();

  if (!config?.enabled || !config.key) {
    return null;
  }

  const wsHost = getPreferredWsHost(config);

  if (!wsHost) {
    return null;
  }

  if (!echoInstance || echoInstanceHost !== wsHost) {
    echoInstance?.disconnect();
    window.Pusher = Pusher;

    echoInstance = new Echo({
      broadcaster: "reverb",
      key: config.key,
      wsHost,
      wsPort: config.wsPort,
      wssPort: config.wssPort,
      forceTLS: config.forceTLS,
      enabledTransports: ["ws", "wss"],
      disableStats: true,
    });
    echoInstanceHost = wsHost;
  }

  return echoInstance;
};

const channelName = (tenantId: string, barberId: string, date: string) =>
  `tenant.${tenantId}.barber.${barberId}.date.${date}`;

export const subscribeAppointmentAvailability = (
  date: string,
  barberId: string,
  callback: () => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo) {
    return () => undefined;
  }

  const name = channelName(config.tenantId, barberId, date);
  const channel = echo.channel(name);
  channel.listen(".appointment.availability.changed", callback);

  return () => {
    channel.stopListening(".appointment.availability.changed");
    echo.leaveChannel(name);
  };
};

const smsCampaignChannelName = (tenantId: string) => `tenant.${tenantId}.sms-campaigns`;

export const subscribeSmsCampaignUpdates = (
  callback: (payload: { campaign: Record<string, unknown> }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo) {
    return () => undefined;
  }

  const name = smsCampaignChannelName(config.tenantId);
  const channel = echo.channel(name);
  channel.listen(".sms-campaign.updated", callback);

  return () => {
    channel.stopListening(".sms-campaign.updated");
    echo.leaveChannel(name);
  };
};

const supportTicketChannelName = (tenantId: string) => `tenant.${tenantId}.support-tickets`;
const appointmentChannelName = (tenantId: string) => `tenant.${tenantId}.appointments`;
const onlineChatAdminChannelName = (tenantId: string) => `tenant.${tenantId}.online-chat.admin`;
const onlineChatUserChannelName = (tenantId: string, tenantUserId: string) => `tenant.${tenantId}.online-chat.user.${tenantUserId}`;
const userNotificationChannelName = (tenantId: string, tenantUserId: string) =>
  `tenant.${tenantId}.user.${tenantUserId}.notifications`;
const userNutritionChannelName = (tenantId: string, tenantUserId: string) =>
  `tenant.${tenantId}.user.${tenantUserId}.nutrition`;

export const subscribeSupportTicketUpdates = (
  callback: (payload: { ticket: Record<string, unknown>; action: string }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo) {
    return () => undefined;
  }

  const name = supportTicketChannelName(config.tenantId);
  const channel = echo.channel(name);
  channel.listen(".support-ticket.updated", callback);

  return () => {
    channel.stopListening(".support-ticket.updated");
    echo.leaveChannel(name);
  };
};

export const subscribeOnlineChatAdminUpdates = (
  callback: (payload: { conversation: Record<string, unknown>; action: string }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo) {
    return () => undefined;
  }

  const name = onlineChatAdminChannelName(config.tenantId);
  const channel = echo.channel(name);
  channel.listen(".online-chat.conversation.updated", callback);

  return () => {
    channel.stopListening(".online-chat.conversation.updated");
    echo.leaveChannel(name);
  };
};

export const subscribeOnlineChatUserUpdates = (
  tenantUserId: string,
  callback: (payload: { conversation: Record<string, unknown>; action: string }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo || !tenantUserId) {
    return () => undefined;
  }

  const name = onlineChatUserChannelName(config.tenantId, tenantUserId);
  const channel = echo.channel(name);
  channel.listen(".online-chat.conversation.updated", callback);

  return () => {
    channel.stopListening(".online-chat.conversation.updated");
    echo.leaveChannel(name);
  };
};

export const subscribeAppointmentBooked = (
  callback: (payload: {
    appointment: {
      id: string;
      barberId: string;
      barberName: string;
      barberUserId?: string | null;
      bookedByUserId?: string | null;
      bookedByRole?: string | null;
      sectionId: string;
      sectionName: string;
      date: string;
      startTime: string;
      endTime: string;
      customerName: string;
      customerPhone: string;
    };
  }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo) {
    return () => undefined;
  }

  const name = appointmentChannelName(config.tenantId);
  const channel = echo.channel(name);
  channel.listen(".appointment.booked", callback);

  return () => {
    channel.stopListening(".appointment.booked");
    echo.leaveChannel(name);
  };
};

export const subscribeUserNotificationInboxUpdates = (
  tenantUserId: string,
  callback: (payload: { tenantUserId: string; unreadCount: number }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo || !tenantUserId) {
    return () => undefined;
  }

  const name = userNotificationChannelName(config.tenantId, tenantUserId);
  const channel = echo.channel(name);
  channel.listen(".user-notification.inbox-updated", callback);

  return () => {
    channel.stopListening(".user-notification.inbox-updated");
    echo.leaveChannel(name);
  };
};

export const subscribeNutritionMealReplacementSuggestionUpdates = (
  tenantUserId: string,
  callback: (payload: {
    tenantUserId: string;
    suggestion: {
      id: string;
      status: string;
      errorMessage?: string | null;
      sourceType?: string;
      mealSlotKey?: string;
      dayNumber?: number | null;
      mealIndex?: number | null;
      requestedAt?: string | null;
      generatedAt?: string | null;
      cancelledAt?: string | null;
    };
  }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo || !tenantUserId) {
    return () => undefined;
  }

  const name = userNutritionChannelName(config.tenantId, tenantUserId);
  const channel = echo.channel(name);
  channel.listen(".nutrition.meal-replacement-suggestion.updated", callback);

  return () => {
    channel.stopListening(".nutrition.meal-replacement-suggestion.updated");
    echo.leaveChannel(name);
  };
};

export const subscribeNutritionDietRequestUpdates = (
  tenantUserId: string,
  callback: (payload: {
    tenantUserId: string;
    dietRequest: {
      id: string;
      status: string;
      aiGenerationStatus: string;
      aiGenerationError?: string | null;
      aiGeneratedAt?: string | null;
      updatedAt?: string | null;
    };
  }) => void,
) => {
  const config = getConfig();
  const echo = getEcho();

  if (!config || !echo || !tenantUserId) {
    return () => undefined;
  }

  const name = userNutritionChannelName(config.tenantId, tenantUserId);
  const channel = echo.channel(name);
  channel.listen(".nutrition.diet-request.updated", callback);

  return () => {
    channel.stopListening(".nutrition.diet-request.updated");
    echo.leaveChannel(name);
  };
};
