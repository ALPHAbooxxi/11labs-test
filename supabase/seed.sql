insert into public.restaurants (
  id,
  name,
  inbound_phone_number,
  greeting,
  address,
  opening_hours,
  active
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Pizzeria Roma',
    '+493012345670',
    'Willkommen bei Pizzeria Roma in Berlin. Was moechten Sie heute bestellen?',
    'Hauptstrasse 10, 10827 Berlin',
    'Mo-So 11:00-22:00',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Pizzeria Napoli',
    '+498912345670',
    'Buongiorno bei Pizzeria Napoli in Muenchen. Wie kann ich helfen?',
    'Marienplatz 5, 80331 Muenchen',
    'Di-So 12:00-23:00',
    true
  )
on conflict (id) do update set
  name = excluded.name,
  inbound_phone_number = excluded.inbound_phone_number,
  greeting = excluded.greeting,
  address = excluded.address,
  opening_hours = excluded.opening_hours,
  active = excluded.active;

insert into public.menu_items (
  restaurant_id,
  name,
  description,
  price,
  category,
  sizes,
  available
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Pizza Margherita',
    'Tomatensauce, Mozzarella, Basilikum',
    8.50,
    'Pizza',
    '{"klein": 7.50, "mittel": 8.50, "gross": 10.50}'::jsonb,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Pizza Salami',
    'Tomatensauce, Mozzarella, Salami',
    9.50,
    'Pizza',
    '{"klein": 8.50, "mittel": 9.50, "gross": 11.50}'::jsonb,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Pizza Margherita',
    'San-Marzano-Tomaten, Fior di Latte, Basilikum',
    9.00,
    'Pizza',
    '{"mittel": 9.00, "gross": 12.00}'::jsonb,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Coca-Cola 0,33l',
    'Kaltgetraenk',
    2.50,
    'Getraenke',
    null,
    true
  );
