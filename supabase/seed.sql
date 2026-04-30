insert into public.restaurants (
  id,
  name,
  inbound_phone_number,
  greeting,
  address,
  opening_hours,
  delivery_enabled,
  pickup_enabled,
  minimum_order_amount,
  delivery_fee,
  delivery_area_notes,
  payment_methods,
  handoff_phone_number,
  special_notes,
  active
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Pizzeria Roma',
    '+493012345670',
    'Willkommen bei Pizzeria Roma in Berlin. Was moechten Sie heute bestellen?',
    'Hauptstrasse 10, 10827 Berlin',
    'Mo-So 11:00-22:00',
    true,
    true,
    15.00,
    2.50,
    'Lieferung im Umkreis von 3 km',
    '["cash", "card"]'::jsonb,
    '+493012345699',
    'Bei groesseren Gruppenbestellungen Rueckruf durch Filiale anbieten.',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Pizzeria Napoli',
    '+498912345670',
    'Buongiorno bei Pizzeria Napoli in Muenchen. Wie kann ich helfen?',
    'Marienplatz 5, 80331 Muenchen',
    'Di-So 12:00-23:00',
    false,
    true,
    0,
    0,
    'Keine Lieferung, nur Abholung.',
    '["cash"]'::jsonb,
    '+498912345699',
    'Glutenfreie Optionen nur nach Rueckfrage in der Filiale.',
    true
  )
on conflict (id) do update set
  name = excluded.name,
  inbound_phone_number = excluded.inbound_phone_number,
  greeting = excluded.greeting,
  address = excluded.address,
  opening_hours = excluded.opening_hours,
  delivery_enabled = excluded.delivery_enabled,
  pickup_enabled = excluded.pickup_enabled,
  minimum_order_amount = excluded.minimum_order_amount,
  delivery_fee = excluded.delivery_fee,
  delivery_area_notes = excluded.delivery_area_notes,
  payment_methods = excluded.payment_methods,
  handoff_phone_number = excluded.handoff_phone_number,
  special_notes = excluded.special_notes,
  active = excluded.active;

delete from public.menu_items
where restaurant_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

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
    '11111111-1111-1111-1111-111111111111',
    'Pizza Funghi',
    'Tomatensauce, Mozzarella, Champignons',
    9.00,
    'Pizza',
    '{"klein": 8.00, "mittel": 9.00, "gross": 11.00}'::jsonb,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Pizza Prosciutto',
    'Tomatensauce, Mozzarella, Kochschinken',
    9.50,
    'Pizza',
    '{"klein": 8.50, "mittel": 9.50, "gross": 11.50}'::jsonb,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Pizza Tonno',
    'Tomatensauce, Mozzarella, Thunfisch, rote Zwiebeln',
    10.50,
    'Pizza',
    '{"klein": 9.50, "mittel": 10.50, "gross": 12.50}'::jsonb,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Pizza Vegetaria',
    'Tomatensauce, Mozzarella, Paprika, Champignons, Oliven, Zwiebeln',
    10.00,
    'Pizza',
    '{"klein": 9.00, "mittel": 10.00, "gross": 12.00}'::jsonb,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Pasta Napoli',
    'Penne mit Tomatensauce und Basilikum',
    8.00,
    'Pasta',
    null,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Pasta Bolognese',
    'Spaghetti mit Rinderhackfleisch-Tomatensauce',
    9.50,
    'Pasta',
    null,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Insalata Mista',
    'Gemischter Salat mit Hausdressing',
    6.50,
    'Salat',
    null,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Tiramisu',
    'Hausgemachtes Tiramisu',
    4.90,
    'Dessert',
    null,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Coca-Cola 0,33l',
    'Kaltgetraenk',
    2.50,
    'Getraenke',
    null,
    true
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Mineralwasser 0,5l',
    'Sprudelwasser',
    2.20,
    'Getraenke',
    null,
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
    'Pizza Diavola',
    'San-Marzano-Tomaten, Fior di Latte, scharfe Salami, Chili',
    11.50,
    'Pizza',
    '{"mittel": 11.50, "gross": 14.00}'::jsonb,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Pizza Capricciosa',
    'Tomaten, Mozzarella, Schinken, Champignons, Artischocken, Oliven',
    12.00,
    'Pizza',
    '{"mittel": 12.00, "gross": 14.50}'::jsonb,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Pizza Quattro Formaggi',
    'Mozzarella, Gorgonzola, Parmesan, Scamorza',
    12.50,
    'Pizza',
    '{"mittel": 12.50, "gross": 15.00}'::jsonb,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Gnocchi Sorrentina',
    'Gnocchi mit Tomatensauce, Mozzarella und Basilikum',
    10.50,
    'Pasta',
    null,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Lasagne al Forno',
    'Hausgemachte Lasagne mit Ragu und Bechamel',
    11.00,
    'Pasta',
    null,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Caprese',
    'Tomaten, Mozzarella, Basilikum, Olivenoel',
    7.50,
    'Vorspeise',
    null,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Panna Cotta',
    'Panna Cotta mit Beerensauce',
    4.90,
    'Dessert',
    null,
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
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'San Pellegrino 0,5l',
    'Mineralwasser mit Kohlensaeure',
    2.80,
    'Getraenke',
    null,
    true
  );
