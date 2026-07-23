import { PaymentProvider } from "./types";
import type { MessageKey } from "@/i18n/messages";

export type PaymentGatewayField = {
  key: string;
  labelKey: MessageKey;
  placeholder?: string;
};

export type PaymentGatewayDefinition = {
  key: PaymentProvider;
  labelKey: MessageKey;
  fields: PaymentGatewayField[];
};

export const PAYMENT_GATEWAYS: PaymentGatewayDefinition[] = [
  {
    key: "zibal",
    labelKey: "paymentGateways.zibal",
    fields: [{ key: "merchantId", labelKey: "paymentGateways.field.merchantId", placeholder: "merchant-id" }],
  },
  {
    key: "saman",
    labelKey: "paymentGateways.saman",
    fields: [
      { key: "merchantId", labelKey: "paymentGateways.field.merchantId", placeholder: "merchant-id" },
      { key: "password", labelKey: "paymentGateways.field.gatewayPassword", placeholder: "password" },
    ],
  },
  {
    key: "digipay",
    labelKey: "paymentGateways.digipay",
    fields: [
      { key: "username", labelKey: "paymentGateways.field.username", placeholder: "username" },
      { key: "password", labelKey: "paymentGateways.field.password", placeholder: "password" },
      { key: "clientId", labelKey: "paymentGateways.field.clientId", placeholder: "client-id" },
      { key: "clientSecret", labelKey: "paymentGateways.field.clientSecret", placeholder: "client-secret" },
    ],
  },
  {
    key: "asanpardakht",
    labelKey: "paymentGateways.asanpardakht",
    fields: [
      { key: "username", labelKey: "paymentGateways.field.username", placeholder: "username" },
      { key: "password", labelKey: "paymentGateways.field.password", placeholder: "password" },
      { key: "merchantConfigID", labelKey: "paymentGateways.field.merchantConfigId", placeholder: "config-id" },
    ],
  },
  {
    key: "parsian",
    labelKey: "paymentGateways.parsian",
    fields: [{ key: "merchantId", labelKey: "paymentGateways.field.merchantId", placeholder: "merchant-id" }],
  },
  {
    key: "pasargad",
    labelKey: "paymentGateways.pasargad",
    fields: [
      { key: "userName", labelKey: "paymentGateways.field.username", placeholder: "username" },
      { key: "password", labelKey: "paymentGateways.field.password", placeholder: "password" },
      { key: "merchantId", labelKey: "paymentGateways.field.merchantId", placeholder: "merchant-id" },
      { key: "terminalCode", labelKey: "paymentGateways.field.terminalCode", placeholder: "terminal-code" },
    ],
  },
  {
    key: "zarinpal",
    labelKey: "paymentGateways.zarinpal",
    fields: [{ key: "merchantId", labelKey: "paymentGateways.field.merchantId", placeholder: "merchant-id" }],
  },
];

export const PAYMENT_GATEWAY_MAP = Object.fromEntries(
  PAYMENT_GATEWAYS.map((gateway) => [gateway.key, gateway]),
) as Record<PaymentProvider, PaymentGatewayDefinition>;
