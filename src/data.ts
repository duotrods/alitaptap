export type MenuItem = {
  id: number
  name: string
  description: string
  price: number
  category: string
  color: string
  emoji: string
  popular?: boolean
}

export const menuItems: MenuItem[] = [
  { id: 1, name: 'Spanish Latte', description: 'Espresso, silky milk, and a touch of condensed milk.', price: 145, category: 'Coffee', color: '#c98755', emoji: '☕', popular: true },
  { id: 2, name: 'Sea Salt Latte', description: 'Creamy espresso finished with a cloud of sea salt foam.', price: 155, category: 'Coffee', color: '#9c765a', emoji: '🥛' },
  { id: 3, name: 'Tablea Mocha', description: 'Local cacao, double espresso, and steamed fresh milk.', price: 165, category: 'Coffee', color: '#765447', emoji: '🍫', popular: true },
  { id: 4, name: 'Calamansi Fizz', description: 'Fresh calamansi, soda, and wildflower honey.', price: 115, category: 'Refreshers', color: '#a9b95f', emoji: '🍋' },
  { id: 5, name: 'Mango Iced Tea', description: 'House-brewed black tea with ripe Philippine mango.', price: 125, category: 'Refreshers', color: '#e1a943', emoji: '🥭' },
  { id: 6, name: 'Ube Ensaymada', description: 'Soft brioche, ube halaya, butter, and aged cheese.', price: 95, category: 'Bakes', color: '#9d7ab2', emoji: '🧁', popular: true },
  { id: 7, name: 'Tuna Pandesal', description: 'Warm pandesal with tuna, herbs, and melted cheese.', price: 110, category: 'Bakes', color: '#d59d66', emoji: '🥪' },
  { id: 8, name: 'Banana Loaf', description: 'Moist banana bread with muscovado and walnuts.', price: 85, category: 'Bakes', color: '#ad895d', emoji: '🍌' },
]

export const peso = (amount: number) => `₱${amount.toLocaleString('en-PH')}`
