export const OrderStatus = { OPEN: 'OPEN', CLOSED: 'CLOSED' } as const;
export type Order = { id: string; status: keyof typeof OrderStatus };
