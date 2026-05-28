import client from './client';

export const createCheckout = async (plan) => {
  const response = await client.post('/billing/checkout', { plan });
  return response.data;
};
