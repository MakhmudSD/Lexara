import client from './client';

export const createCheckout = async (plan) => {
  const response = await client.post('/billing/checkout', { plan });
  return response.data;
};

export const redeemPromo = async (code) => {
  const response = await client.post('/billing/promo', { code });
  return response.data;
};
