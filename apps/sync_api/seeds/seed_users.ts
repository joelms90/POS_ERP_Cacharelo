import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex('users').del();

  // Inserts seed entries
  await knex('users').insert([
    { id: 'e55d6480-1a76-47b2-bdcf-8848c7720977', name: 'Juan (Mesero)', pin: '1111', role: 'waiter' },
    { id: 'f77c3852-c3a8-4a41-b258-39324ad72301', name: 'Sofia (Cajero)', pin: '2222', role: 'cashier' },
    { id: 'a44b9bfa-b715-46f9-bcbf-4789d2ea03bb', name: 'Chef Carlos', pin: '3333', role: 'kitchen' }
  ]);
}
